"use server"

import { revalidatePath } from "next/cache"
import { calculateDurationHours, type RecurrenceType } from "@/lib/calendar-types"
import { addDays, isIsoDate } from "@/lib/dates"
import { getDb } from "@/lib/db"
import { guildEventSignups, guildEvents, users } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { and, eq } from "drizzle-orm"

type ActionResult =
  | { ok: true; message?: string; eventId?: string }
  | { ok: false; error: string }

function ok(message?: string, eventId?: string): ActionResult {
  return { ok: true, message, eventId }
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

export async function createGuildEvent(input: {
  title: string
  type: string
  color?: string
  date: string
  startTime: string
  endTime: string
  recurrence?: RecurrenceType
  recurringDays?: number[] // 1 = Poniedziałek, 2 = Wtorek, ..., 7 = Niedziela
  recurrenceWeeks?: number
  maxParticipants?: number | null
  description?: string
}): Promise<ActionResult> {
  const user = await requireUser()

  const title = input.title.trim()
  if (!title) return fail("Nazwa nie może być pusta.")

  if (!isIsoDate(input.date)) {
    return fail("Nieprawidłowa data (format RRRR-MM-DD).")
  }

  if (!/^\d{1,2}:\d{2}$/.test(input.startTime)) {
    return fail("Nieprawidłowa godzina startu (format HH:MM).")
  }

  if (!/^\d{1,2}:\d{2}$/.test(input.endTime)) {
    return fail("Nieprawidłowa godzina końca (format HH:MM).")
  }

  const durationHours = calculateDurationHours(input.startTime, input.endTime)
  const maxParts = input.maxParticipants ? Math.max(1, Math.round(input.maxParticipants)) : null
  
  // Compute dates to create
  const datesSet = new Set<string>()
  datesSet.add(input.date)

  if (input.recurringDays && input.recurringDays.length > 0) {
    const weeks = Math.min(8, Math.max(1, input.recurrenceWeeks || 4))
    const selectedDaysSet = new Set(input.recurringDays) // 1=Mon .. 7=Sun

    for (let i = 0; i < weeks * 7; i++) {
      const targetDate = addDays(input.date, i)
      const [y, m, d] = targetDate.split("-").map(Number)
      const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      // Convert JS day (0=Sun, 1=Mon...6=Sat) to 1=Mon .. 7=Sun
      const dayIso = jsDay === 0 ? 7 : jsDay
      if (selectedDaysSet.has(dayIso)) {
        datesSet.add(targetDate)
      }
    }
  } else if (input.recurrence && input.recurrence !== "none") {
    if (input.recurrence === "daily") {
      const days = Math.min(14, Math.max(2, (input.recurrenceWeeks || 1) * 7))
      for (let i = 1; i < days; i++) {
        datesSet.add(addDays(input.date, i))
      }
    } else if (input.recurrence === "weekly") {
      const weeks = Math.min(8, Math.max(2, input.recurrenceWeeks || 4))
      for (let i = 1; i < weeks; i++) {
        datesSet.add(addDays(input.date, i * 7))
      }
    } else if (input.recurrence === "weekdays") {
      const weeks = Math.min(4, Math.max(1, input.recurrenceWeeks || 2))
      for (let i = 1; i < weeks * 7; i++) {
        const targetDate = addDays(input.date, i)
        const [y, m, d] = targetDate.split("-").map(Number)
        const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          datesSet.add(targetDate)
        }
      }
    }
  }

  const datesToCreate = Array.from(datesSet).sort()
  const recurrenceLabel = input.recurringDays && input.recurringDays.length > 0
    ? `custom:${input.recurringDays.join(",")}`
    : (input.recurrence || "none")

  const db = await getDb()
  let firstEventId = ""

  for (let i = 0; i < datesToCreate.length; i++) {
    const targetDate = datesToCreate[i]
    const eventId = crypto.randomUUID()
    if (i === 0) firstEventId = eventId

    await db.insert(guildEvents).values({
      id: eventId,
      title,
      type: input.type || "v3",
      color: input.color || "blue",
      date: targetDate,
      startTime: input.startTime,
      endTime: input.endTime,
      durationHours: Math.max(1, Math.round(durationHours)),
      signupMode: "spots",
      recurrence: recurrenceLabel,
      maxParticipants: maxParts,
      description: input.description?.trim() || null,
      status: "planned",
      createdBy: user.id,
    })
  }

  revalidatePath("/kalendarz")
  revalidatePath("/")

  const message = datesToCreate.length > 1
    ? `Utworzono serię ${datesToCreate.length} cyklicznych wydarzeń!`
    : "Wydarzenie zostało zaplanowane!"

  return ok(message, firstEventId)
}

export async function signUpForGuildEvent(input: {
  eventId: string
  spot?: string
  role?: string
  hourIndex?: number
  targetUserId?: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const targetUserId = (user.isLeader && input.targetUserId) ? input.targetUserId : user.id

  const [event] = await db
    .select({
      id: guildEvents.id,
      type: guildEvents.type,
      maxParticipants: guildEvents.maxParticipants,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, input.eventId))

  if (!event) return fail("Nie znaleziono wydarzenia.")

  // If spot is provided (e.g. V3 spot R1 or Red Las spot), check if spot is already taken
  if (input.spot) {
    const [existingSpot] = await db
      .select({ id: guildEventSignups.id })
      .from(guildEventSignups)
      .where(
        and(
          eq(guildEventSignups.eventId, input.eventId),
          eq(guildEventSignups.spot, input.spot)
        )
      )

    if (existingSpot) {
      return fail(`Miejscówka ${input.spot} jest już zajęta!`)
    }
  }

  // Check if this specific user already signed up for this event (unless leader adding multiple)
  const [existingUser] = await db
    .select({ id: guildEventSignups.id, spot: guildEventSignups.spot })
    .from(guildEventSignups)
    .where(
      and(
        eq(guildEventSignups.eventId, input.eventId),
        eq(guildEventSignups.userId, targetUserId)
      )
    )

  if (existingUser) {
    if (input.spot) {
      return fail(`Gracz jest już zapisany na miejscówkę (${existingUser.spot || "zapisany"}). Zwolnij ją najpierw.`)
    }
    return fail("Gracz jest już zapisany na to wydarzenie.")
  }

  // For V3 events, determine role from user's account playstyle if not explicitly provided
  let userRole = input.role?.trim() || null
  if (event.type === "v3" && !userRole) {
    const [targetUser] = await db
      .select({ playstyle: users.playstyle })
      .from(users)
      .where(eq(users.id, targetUserId))

    if (!targetUser?.playstyle) {
      return fail(
        targetUserId === user.id
          ? "Najpierw ustaw PVP albo PVM w koncie (zakładka Konto)."
          : "Wybrany gracz nie ma ustawionego trybu PVP/PVM w profilu."
      )
    }

    userRole = targetUser.playstyle === "pvp" ? "PvP" : "PvM"
  }

  await db.insert(guildEventSignups).values({
    id: crypto.randomUUID(),
    eventId: input.eventId,
    userId: targetUserId,
    hourIndex: input.hourIndex ?? 0,
    spot: input.spot || null,
    role: userRole,
    attended: true,
  })

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${input.eventId}`)
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok("Zapisano pomyślnie!")
}

export async function withdrawFromGuildEvent(input: {
  signupId: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [signup] = await db
    .select({
      id: guildEventSignups.id,
      eventId: guildEventSignups.eventId,
      userId: guildEventSignups.userId,
    })
    .from(guildEventSignups)
    .where(eq(guildEventSignups.id, input.signupId))

  if (!signup) return fail("Nie znaleziono zapisu.")

  if (!user.isLeader && signup.userId !== user.id) {
    return fail("Możesz wypisać tylko siebie.")
  }

  await db.delete(guildEventSignups).where(eq(guildEventSignups.id, input.signupId))

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${signup.eventId}`)
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok("Wypisano z wydarzenia.")
}

export async function toggleGuildEventAttendance(signupId: string): Promise<ActionResult> {
  await requireUser()
  const db = await getDb()

  const [signup] = await db
    .select({
      id: guildEventSignups.id,
      eventId: guildEventSignups.eventId,
      attended: guildEventSignups.attended,
    })
    .from(guildEventSignups)
    .where(eq(guildEventSignups.id, signupId))

  if (!signup) return fail("Nie znaleziono zapisu.")

  const newStatus = !signup.attended
  await db
    .update(guildEventSignups)
    .set({ attended: newStatus })
    .where(eq(guildEventSignups.id, signupId))

  revalidatePath(`/kalendarz/wydarzenie/${signup.eventId}`)
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok(newStatus ? "Obecność potwierdzona!" : "Odznaczono obecność.")
}

export async function updateGuildEventStatus(
  eventId: string,
  status: "planned" | "active" | "finished" | "cancelled"
): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [event] = await db
    .select({ id: guildEvents.id, createdBy: guildEvents.createdBy })
    .from(guildEvents)
    .where(eq(guildEvents.id, eventId))

  if (!event) return fail("Nie znaleziono wydarzenia.")
  if (!user.isLeader && event.createdBy !== user.id) {
    return fail("Brak uprawnień do zmiany statusu wydarzenia.")
  }

  await db.update(guildEvents).set({ status }).where(eq(guildEvents.id, eventId))

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${eventId}`)
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok("Zaktualizowano status wydarzenia.")
}

export async function deleteGuildEvent(eventId: string): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [event] = await db
    .select({ id: guildEvents.id, createdBy: guildEvents.createdBy })
    .from(guildEvents)
    .where(eq(guildEvents.id, eventId))

  if (!event) return fail("Nie znaleziono wydarzenia.")
  if (!user.isLeader && event.createdBy !== user.id) {
    return fail("Brak uprawnień do usunięcia tego wydarzenia.")
  }

  await db.delete(guildEvents).where(eq(guildEvents.id, eventId))

  revalidatePath("/kalendarz")
  revalidatePath("/")
  return ok("Usunięto wydarzenie.")
}

export async function rescheduleGuildEvent(input: {
  eventId: string
  date: string
  startTime: string
  endTime: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  if (!isIsoDate(input.date)) {
    return fail("Nieprawidłowa data (format RRRR-MM-DD).")
  }

  if (!/^\d{1,2}:\d{2}$/.test(input.startTime)) {
    return fail("Nieprawidłowa godzina startu (format HH:MM).")
  }

  if (!/^\d{1,2}:\d{2}$/.test(input.endTime)) {
    return fail("Nieprawidłowa godzina końca (format HH:MM).")
  }

  const [event] = await db
    .select({ id: guildEvents.id, createdBy: guildEvents.createdBy })
    .from(guildEvents)
    .where(eq(guildEvents.id, input.eventId))

  if (!event) return fail("Nie znaleziono wydarzenia.")
  if (!user.isLeader && event.createdBy !== user.id) {
    return fail("Tylko Admin lub twórca wydarzenia może zmieniać termin wydarzenia.")
  }

  const durationHours = calculateDurationHours(input.startTime, input.endTime)

  await db
    .update(guildEvents)
    .set({
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      durationHours: Math.max(1, Math.round(durationHours)),
    })
    .where(eq(guildEvents.id, input.eventId))

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${input.eventId}`)
  revalidatePath("/")
  return ok("Zaktualizowano termin wydarzenia.")
}

export async function getGuildEventModalDetails(eventId: string) {
  const { getGuildEventDetails } = await import("@/lib/calendar-queries")
  const event = await getGuildEventDetails(eventId)
  return event
}

