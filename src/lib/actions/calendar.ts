"use server"

import { revalidatePath } from "next/cache"
import { calculateDurationHours, type RecurrenceType } from "@/lib/calendar-types"
import { addDays, formatDatePl, getV3SignupOpenDate, isIsoDate, isV3SignupDateLocked } from "@/lib/dates"
import { getDb } from "@/lib/db"
import { getCurrentUser, requireUser } from "@/lib/session"
import { and, eq } from "drizzle-orm"
import { guildEventSignups, guildEvents, users } from "@/lib/db/schema"
import { hasV3Access } from "@/lib/permissions"
import { findUserById } from "@/lib/db/users"

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
      date: guildEvents.date,
      maxParticipants: guildEvents.maxParticipants,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, input.eventId))

  if (!event) return fail("Nie znaleziono wydarzenia.")

  // For V3 events, block signups if user does not have V3 access
  if (event.type === "v3") {
    const targetUser = targetUserId === user.id ? user : await findUserById(targetUserId)
    if (!targetUser || !hasV3Access(targetUser)) {
      return fail("Tylko zweryfikowani członkowie z przypisaną rolą V3 mogą zapisywać się na V3.")
    }

    const isSelfSignup = !input.targetUserId || targetUserId === user.id
    if ((isSelfSignup || !user.isLeader) && isV3SignupDateLocked(event.date)) {
      return fail(
        `Zapisy na ten event V3 ruszają na 2 dni przed wydarzeniem (od ${formatDatePl(getV3SignupOpenDate(event.date))}).`
      )
    }

    // Check fee settlement lock: if user has unpaid fees from previous week (and grace period expired)
    if (isSelfSignup || !user.isLeader) {
      const { checkUserFeeLock } = await import("@/lib/settings")
      const feeLock = await checkUserFeeLock(targetUserId)
      if (feeLock.isLocked) {
        return fail(
          feeLock.reason ??
            `Nie możesz zapisać się na V3: masz nieuregulowaną składkę za poprzedni tydzień (${feeLock.overdueKk} kk). Ureguluj ją w zakładce Składki.`
        )
      }
    }
  }

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

export async function deleteGuildEvent(
  eventId: string,
  options?: { deleteAllInSeries?: boolean }
): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [event] = await db
    .select({
      id: guildEvents.id,
      title: guildEvents.title,
      type: guildEvents.type,
      startTime: guildEvents.startTime,
      createdBy: guildEvents.createdBy,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, eventId))

  if (!event) return fail("Nie znaleziono wydarzenia.")
  if (!user.isLeader && event.createdBy !== user.id) {
    return fail("Brak uprawnień do usunięcia tego wydarzenia.")
  }

  if (options?.deleteAllInSeries) {
    await db
      .delete(guildEvents)
      .where(
        and(
          eq(guildEvents.title, event.title),
          eq(guildEvents.type, event.type),
          eq(guildEvents.startTime, event.startTime),
          eq(guildEvents.createdBy, event.createdBy)
        )
      )
  } else {
    await db.delete(guildEvents).where(eq(guildEvents.id, eventId))
  }

  revalidatePath("/kalendarz")
  revalidatePath("/")
  revalidatePath("/panel")
  return ok(
    options?.deleteAllInSeries
      ? "Usunięto wszystkie wydarzenia z tej serii."
      : "Usunięto wydarzenie."
  )
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

export async function updateGuildEventProperties(input: {
  eventId: string
  title?: string
  type?: string
  color?: string
  date?: string
  startTime?: string
  endTime?: string
  maxParticipants?: number | null
  description?: string
  updateAllInSeries?: boolean
}): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [targetEvent] = await db
    .select({
      id: guildEvents.id,
      title: guildEvents.title,
      type: guildEvents.type,
      startTime: guildEvents.startTime,
      createdBy: guildEvents.createdBy,
      recurrence: guildEvents.recurrence,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, input.eventId))

  if (!targetEvent) return fail("Nie znaleziono wydarzenia.")
  if (!user.isLeader && targetEvent.createdBy !== user.id) {
    return fail("Tylko Admin lub twórca wydarzenia może edytować jego właściwości.")
  }

  const updates: {
    title?: string
    type?: string
    color?: string
    date?: string
    startTime?: string
    endTime?: string
    durationHours?: number
    maxParticipants?: number | null
    description?: string | null
  } = {}

  if (input.title && input.title.trim()) updates.title = input.title.trim()
  if (input.type) updates.type = input.type
  if (input.color) updates.color = input.color
  if (input.startTime) updates.startTime = input.startTime
  if (input.endTime) updates.endTime = input.endTime
  if (input.maxParticipants !== undefined) updates.maxParticipants = input.maxParticipants
  if (input.description !== undefined) updates.description = input.description.trim() || null

  if (input.startTime && input.endTime) {
    updates.durationHours = Math.max(1, Math.round(calculateDurationHours(input.startTime, input.endTime)))
  }

  // Single event date can only be changed when not updating all series dates
  if (!input.updateAllInSeries && input.date) {
    if (!isIsoDate(input.date)) return fail("Nieprawidłowa data.")
    updates.date = input.date
  }

  if (Object.keys(updates).length === 0) {
    return ok("Brak zmian do zapisania.")
  }

  if (input.updateAllInSeries) {
    // Update all matching events created by this creator with the same title, type, and start time
    await db
      .update(guildEvents)
      .set(updates)
      .where(
        and(
          eq(guildEvents.title, targetEvent.title),
          eq(guildEvents.type, targetEvent.type),
          eq(guildEvents.startTime, targetEvent.startTime),
          eq(guildEvents.createdBy, targetEvent.createdBy)
        )
      )
  } else {
    await db
      .update(guildEvents)
      .set(updates)
      .where(eq(guildEvents.id, input.eventId))
  }

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${input.eventId}`)
  revalidatePath("/panel")
  return ok(
    input.updateAllInSeries
      ? "Zaktualizowano wszystkie wydarzenia z tej serii."
      : "Zaktualizowano wydarzenie."
  )
}

export async function getGuildEventModalDetails(eventId: string) {
  try {
    const user = await getCurrentUser()
    const { getGuildEventDetails } = await import("@/lib/calendar-queries")
    const event = await getGuildEventDetails(eventId)
    if (!event) return null

    if (event.type === "v3") {
      const allowed = user ? hasV3Access(user) : false
      if (!allowed) {
        // Mask details for non-V3 members
        return {
          ...event,
          description: null,
          hourSlots: [],
          signups: [],
          allParticipants: [],
          restrictedAccess: true,
        }
      }

      if (user) {
        try {
          const { checkUserFeeLock } = await import("@/lib/settings")
          const currentUserFeeLock = await checkUserFeeLock(user.id)
          return { ...event, currentUserFeeLock, restrictedAccess: false }
        } catch (err) {
          console.error("Error evaluating checkUserFeeLock in getGuildEventModalDetails:", err)
          return { ...event, restrictedAccess: false }
        }
      }
    }
    return event
  } catch (err) {
    console.error("Error in getGuildEventModalDetails:", err)
    return null
  }
}


