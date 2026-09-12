"use server"

import { revalidatePath } from "next/cache"
import { calculateDurationHours, type RecurrenceType } from "@/lib/calendar-types"
import { addDays, formatDatePl, getTimeUntilEvent, getV3SignupOpenDate, isIsoDate, isV3SignupDateLocked, todayInWarsaw } from "@/lib/dates"
import { getDb } from "@/lib/db"
import { getCurrentUser, requireUser } from "@/lib/session"
import { and, eq } from "drizzle-orm"
import { guildEventAuditLogs, guildEventSignups, guildEvents, users } from "@/lib/db/schema"
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
  characterId?: string
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

  // Resolve target user characters
  const { listUserCharacters } = await import("@/lib/actions/characters")
  const userChars = await listUserCharacters(targetUserId)

  let selectedChar = input.characterId
    ? userChars.find((c) => c.id === input.characterId)
    : userChars.find((c) => c.isMain) || userChars[0]

  if (!selectedChar) {
    const targetUser = targetUserId === user.id ? user : await findUserById(targetUserId)
    selectedChar = {
      id: targetUserId,
      name: targetUser?.gameNick || "Gracz",
      playstyle: (targetUser?.playstyle as "pvp" | "pvm") || "pvm",
      isMain: true,
      createdAt: new Date().toISOString(),
    }
  }

  const today = todayInWarsaw(new Date())
  const isEventDay = event.date === today

  // Rule: Non-main character can ONLY be signed up on the day of the event
  if (!selectedChar.isMain && !isEventDay) {
    return fail(
      `Tą postacią („${selectedChar.name}”) możesz zapisać się wyłącznie w dniu wydarzenia (od godz. 00:00). Dzięki temu nie blokujesz miejsc innym graczom z wyprzedzeniem.`
    )
  }

  // For V3 events, block signups if user does not have V3 access
  if (event.type === "v3") {
    const targetUser = targetUserId === user.id ? user : await findUserById(targetUserId)
    if (!targetUser || !hasV3Access(targetUser)) {
      return fail("Tylko zweryfikowani członkowie z przypisaną rolą V3 mogą zapisywać się na V3.")
    }

    const isSelfSignup = !input.targetUserId || targetUserId === user.id

    // Determine configured advance days, opening time, and yellow card penalty limit
    const { getSignupAdvanceDays, getSignupOpenTime } = await import("@/lib/settings")
    let maxDaysAhead = await getSignupAdvanceDays()
    const signupOpenTime = await getSignupOpenTime()

    if (isSelfSignup || !user.isLeader) {
      const { getActivePenaltyForUser } = await import("@/lib/actions/penalties")
      const activePenalty = await getActivePenaltyForUser(targetUserId)
      if (activePenalty) {
        maxDaysAhead = activePenalty.allowedAdvanceDays
        if (isV3SignupDateLocked(event.date, new Date(), maxDaysAhead, signupOpenTime)) {
          return fail(
            `Masz aktywną żółtą kartkę (poziom ${activePenalty.cardLevel}, kara do ${activePenalty.expiresAtPl}). Możesz zapisywać się maksymalnie na ${maxDaysAhead} ${maxDaysAhead === 1 ? "dzień" : "dni"} w przód (zapisy ruszają ${formatDatePl(getV3SignupOpenDate(event.date, maxDaysAhead))} o godz. ${signupOpenTime}). Powód kary: „${activePenalty.reason}”.`
          )
        }
      }
    }

    if ((isSelfSignup || !user.isLeader) && isV3SignupDateLocked(event.date, new Date(), maxDaysAhead, signupOpenTime)) {
      return fail(
        `Zapisy na ten event V3 ruszają na ${maxDaysAhead} ${maxDaysAhead === 1 ? "dzień" : "dni"} przed wydarzeniem (od ${formatDatePl(getV3SignupOpenDate(event.date, maxDaysAhead))} o godz. ${signupOpenTime}).`
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

  // Check existing signups for this user on this event
  const existingUserSignups = await db
    .select({
      id: guildEventSignups.id,
      spot: guildEventSignups.spot,
      characterId: guildEventSignups.characterId,
      characterName: guildEventSignups.characterName,
    })
    .from(guildEventSignups)
    .where(
      and(
        eq(guildEventSignups.eventId, input.eventId),
        eq(guildEventSignups.userId, targetUserId)
      )
    )

  // A: Prevent duplicate signup with the EXACT same character
  const isCharAlreadySigned = existingUserSignups.some(
    (s) =>
      (s.characterId && s.characterId === selectedChar.id) ||
      (s.characterName && s.characterName.toLowerCase() === selectedChar.name.toLowerCase()) ||
      (!s.characterName && selectedChar.isMain)
  )
  if (isCharAlreadySigned) {
    return fail(`Postać „${selectedChar.name}” jest już zapisana na to wydarzenie.`)
  }

  // B: If user already has a spot on this event and is trying to take a 2nd spot
  if (existingUserSignups.length > 0) {
    if (!isEventDay) {
      return fail(
        `Zajmujesz już jedno miejsce na to wydarzenie (${existingUserSignups[0].spot || "zapisany"}). Zapis na drugą postać jest możliwy wyłącznie w dniu trwania wydarzenia.`
      )
    }
    if (existingUserSignups.length >= 2) {
      return fail("Maksymalnie możesz zapisać 2 postacie na jedno wydarzenie.")
    }
  }

  // Determine role: prefer input role, fallback to character's playstyle, then targetUser's playstyle
  let userRole = input.role?.trim() || null
  if (!userRole) {
    userRole = selectedChar.playstyle === "pvp" ? "PvP" : "PvM"
  }

  // Ensure characterId exists in user_characters to prevent foreign key violation
  let characterIdToInsert: string | null = null
  if (selectedChar?.id && selectedChar.id !== targetUserId) {
    try {
      const { userCharacters } = await import("@/lib/db/schema")
      const [charInDb] = await db
        .select({ id: userCharacters.id })
        .from(userCharacters)
        .where(eq(userCharacters.id, selectedChar.id))
        .limit(1)
      if (charInDb) {
        characterIdToInsert = charInDb.id
      }
    } catch {
      characterIdToInsert = null
    }
  }

  try {
    await db.insert(guildEventSignups).values({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      userId: targetUserId,
      characterId: characterIdToInsert,
      characterName: selectedChar.name,
      hourIndex: input.hourIndex ?? 0,
      spot: input.spot || null,
      role: userRole,
      attended: true,
    })
  } catch (err) {
    console.error("[signUpForGuildEvent] Insert error:", err)
    const { isUniqueViolation } = await import("@/lib/db")
    if (isUniqueViolation(err)) {
      return fail("To miejsce zostało już zajęte lub jesteś już zapisany.")
    }
    return fail("Wystąpił błąd podczas zapisu na wydarzenie. Spróbuj ponownie za chwilę.")
  }

  // Audit log: record signup or admin assignment
  try {
    const isSelfSignup = user.id === targetUserId
    await db.insert(guildEventAuditLogs).values({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      action: isSelfSignup ? "signup" : "admin_assign",
      actorId: user.id,
      targetUserId: isSelfSignup ? null : targetUserId,
      spot: input.spot || null,
      role: userRole,
      reason: null,
      details: `Postać: ${selectedChar.name}${selectedChar.isMain ? " (Główna)" : " (Dodatkowa)"}`,
    })
  } catch (err) {
    console.error("Failed to write audit log in signUpForGuildEvent:", err)
  }

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${input.eventId}`)
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok("Zapisano pomyślnie!")
}

export async function withdrawFromGuildEvent(input: {
  signupId: string
  reason?: string
  giveYellowCard?: boolean
  yellowCardReason?: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [signup] = await db
    .select({
      id: guildEventSignups.id,
      eventId: guildEventSignups.eventId,
      userId: guildEventSignups.userId,
      spot: guildEventSignups.spot,
      role: guildEventSignups.role,
    })
    .from(guildEventSignups)
    .where(eq(guildEventSignups.id, input.signupId))

  if (!signup) return fail("Nie znaleziono zapisu.")

  if (!user.isLeader && signup.userId !== user.id) {
    return fail("Możesz wypisać tylko siebie.")
  }

  // Fetch event date/time to check 2-hour window
  const [event] = await db
    .select({
      id: guildEvents.id,
      date: guildEvents.date,
      startTime: guildEvents.startTime,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, signup.eventId))

  const timeInfo = event ? getTimeUntilEvent(event.date, event.startTime) : null

  await db.delete(guildEventSignups).where(eq(guildEventSignups.id, input.signupId))

  // If leader requested to issue a yellow card
  if (user.isLeader && input.giveYellowCard && signup.userId !== user.id) {
    try {
      const { giveYellowCard } = await import("@/lib/actions/penalties")
      await giveYellowCard({
        userId: signup.userId,
        reason:
          input.yellowCardReason?.trim() ||
          input.reason?.trim() ||
          "Nieobecność / wycofanie ze slota przez administratora",
        eventId: signup.eventId,
      })
    } catch (err) {
      console.error("Failed to give yellow card during withdraw:", err)
    }
  }

  // Audit log: record withdrawal (self or by admin with reason)
  try {
    const isSelfWithdraw = signup.userId === user.id
    await db.insert(guildEventAuditLogs).values({
      id: crypto.randomUUID(),
      eventId: signup.eventId,
      action: isSelfWithdraw ? "withdraw" : "admin_withdraw",
      actorId: user.id,
      targetUserId: isSelfWithdraw ? null : signup.userId,
      spot: signup.spot || null,
      role: signup.role || null,
      reason: isSelfWithdraw ? null : input.reason?.trim() || null,
      details: timeInfo
        ? JSON.stringify({
            isLessThan2Hours: timeInfo.isLessThan2Hours,
            timeRemaining: timeInfo.label,
            hasStarted: timeInfo.hasStarted,
            issuedYellowCard: Boolean(user.isLeader && input.giveYellowCard),
          })
        : null,
    })
  } catch (err) {
    console.error("Failed to write audit log in withdrawFromGuildEvent:", err)
  }

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${signup.eventId}`)
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok("Wypisano z wydarzenia.")
}

export async function transferSpotToUser(input: {
  signupId: string
  targetUserId: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [signup] = await db
    .select({
      id: guildEventSignups.id,
      eventId: guildEventSignups.eventId,
      userId: guildEventSignups.userId,
      spot: guildEventSignups.spot,
      role: guildEventSignups.role,
      hourIndex: guildEventSignups.hourIndex,
    })
    .from(guildEventSignups)
    .where(eq(guildEventSignups.id, input.signupId))

  if (!signup) return fail("Nie znaleziono zapisu.")

  if (!user.isLeader && signup.userId !== user.id) {
    return fail("Możesz przekazać tylko swoją własną miejscówkę.")
  }

  if (signup.userId === input.targetUserId) {
    return fail("Nie możesz przekazać spota samemu sobie.")
  }

  const [targetUser] = await db
    .select({
      id: users.id,
      gameNick: users.gameNick,
      playstyle: users.playstyle,
      roles: users.roles,
      isVerified: users.isVerified,
      isLeader: users.isLeader,
    })
    .from(users)
    .where(eq(users.id, input.targetUserId))

  if (!targetUser) return fail("Nie znaleziono wybranego gracza.")

  const [event] = await db
    .select({
      id: guildEvents.id,
      title: guildEvents.title,
      type: guildEvents.type,
      date: guildEvents.date,
      startTime: guildEvents.startTime,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, signup.eventId))

  if (!event) return fail("Nie znaleziono wydarzenia.")

  if (event.type === "v3") {
    if (!hasV3Access(targetUser)) {
      return fail("Wybrany gracz nie posiada roli V3.")
    }

    const { checkUserFeeLock } = await import("@/lib/settings")
    const feeLock = await checkUserFeeLock(targetUser.id)
    if (feeLock.isLocked) {
      return fail(
        `Wybrany gracz ma zablokowane zapisy z powodu zaległej składki (${feeLock.overdueKk} kk).`
      )
    }
  }

  const [existingSignup] = await db
    .select({ id: guildEventSignups.id })
    .from(guildEventSignups)
    .where(
      and(
        eq(guildEventSignups.eventId, signup.eventId),
        eq(guildEventSignups.userId, input.targetUserId)
      )
    )

  if (existingSignup) {
    return fail("Wybrany gracz jest już zapisany na to wydarzenie.")
  }

  let newRole = signup.role
  const { listUserCharacters } = await import("@/lib/actions/characters")
  const targetChars = await listUserCharacters(input.targetUserId)
  const targetMainChar = targetChars.find((c) => c.isMain) || targetChars[0]

  if (event.type === "v3") {
    newRole = targetMainChar?.playstyle === "pvp" ? "PvP" : targetUser.playstyle === "pvp" ? "PvP" : "PvM"
  }

  let validTargetCharId: string | null = null
  if (targetMainChar?.id) {
    try {
      const { userCharacters } = await import("@/lib/db/schema")
      const [vChar] = await db
        .select({ id: userCharacters.id })
        .from(userCharacters)
        .where(eq(userCharacters.id, targetMainChar.id))
        .limit(1)
      if (vChar) {
        validTargetCharId = vChar.id
      }
    } catch {
      validTargetCharId = null
    }
  }

  try {
    await db
      .update(guildEventSignups)
      .set({
        userId: input.targetUserId,
        characterId: validTargetCharId,
        characterName: targetMainChar?.name || targetUser.gameNick,
        role: newRole,
      })
      .where(eq(guildEventSignups.id, input.signupId))
  } catch (err) {
    console.error("[transferSpotToUser] Update error:", err)
    return fail("Nie udało się przekazać miejsca. Spróbuj ponownie.")
  }

  const timeInfo = getTimeUntilEvent(event.date, event.startTime)

  try {
    await db.insert(guildEventAuditLogs).values({
      id: crypto.randomUUID(),
      eventId: signup.eventId,
      action: "spot_transfer",
      actorId: user.id,
      targetUserId: input.targetUserId,
      spot: signup.spot,
      role: newRole,
      reason: null,
      details: JSON.stringify({
        previousUserId: signup.userId,
        timeRemaining: timeInfo.label,
        isLessThan2Hours: timeInfo.isLessThan2Hours,
      }),
    })
  } catch (err) {
    console.error("Failed to write audit log in transferSpotToUser:", err)
  }

  revalidatePath("/kalendarz")
  revalidatePath(`/kalendarz/wydarzenie/${signup.eventId}`)
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok(`Przekazano miejscówkę ${signup.spot ? `(${signup.spot})` : ""} graczowi ${targetUser.gameNick}.`)
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

  try {
    await db.insert(guildEventAuditLogs).values({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      action: "reschedule",
      actorId: user.id,
      targetUserId: null,
      spot: null,
      role: null,
      reason: null,
      details: JSON.stringify({
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
      }),
    })
  } catch (err) {
    console.error("Failed to write audit log in rescheduleGuildEvent:", err)
  }

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
        let currentUserFeeLock
        try {
          const { checkUserFeeLock } = await import("@/lib/settings")
          currentUserFeeLock = await checkUserFeeLock(user.id)
        } catch (err) {
          console.error("Error evaluating checkUserFeeLock in getGuildEventModalDetails:", err)
        }

        let currentUserPenalty = null
        try {
          const { getActivePenaltyForUser } = await import("@/lib/actions/penalties")
          const pen = await getActivePenaltyForUser(user.id)
          if (pen) {
            currentUserPenalty = {
              hasPenalty: true,
              cardLevel: pen.cardLevel,
              durationDays: pen.durationDays,
              allowedAdvanceDays: pen.allowedAdvanceDays,
              expiresAt: pen.expiresAt,
              expiresAtPl: pen.expiresAtPl,
              reason: pen.reason,
            }
          }
        } catch (err) {
          console.error("Error evaluating getActivePenaltyForUser in getGuildEventModalDetails:", err)
        }

        let signupAdvanceDays = 2
        let signupOpenTime = "09:00"
        try {
          const { getSignupAdvanceDays, getSignupOpenTime } = await import("@/lib/settings")
          signupAdvanceDays = await getSignupAdvanceDays()
          signupOpenTime = await getSignupOpenTime()
        } catch (err) {
          console.error("Error fetching signup settings in getGuildEventModalDetails:", err)
        }

        let auditLogs
        if (user.isLeader) {
          try {
            const { listGuildEventAuditLogs } = await import("@/lib/calendar-queries")
            auditLogs = await listGuildEventAuditLogs(eventId)
          } catch (err) {
            console.error("Error fetching auditLogs in getGuildEventModalDetails:", err)
          }
        }

        let currentUserCharacters: { id: string; name: string; playstyle: "pvp" | "pvm"; isMain: boolean }[] = []
        try {
          const { listUserCharacters } = await import("@/lib/actions/characters")
          currentUserCharacters = await listUserCharacters(user.id)
        } catch (err) {
          console.error("Error fetching currentUserCharacters in getGuildEventModalDetails:", err)
        }

        return {
          ...event,
          currentUserFeeLock,
          currentUserPenalty,
          currentUserCharacters,
          signupAdvanceDays,
          signupOpenTime,
          restrictedAccess: false,
          auditLogs,
        }
      }
    }

    // For non-V3 events, also attach auditLogs and characters if user logged in
    let currentUserCharacters: { id: string; name: string; playstyle: "pvp" | "pvm"; isMain: boolean }[] = []
    if (user) {
      try {
        const { listUserCharacters } = await import("@/lib/actions/characters")
        currentUserCharacters = await listUserCharacters(user.id)
      } catch (err) {
        console.error("Error fetching currentUserCharacters in getGuildEventModalDetails:", err)
      }
    }

    if (user?.isLeader) {
      try {
        const { listGuildEventAuditLogs } = await import("@/lib/calendar-queries")
        const auditLogs = await listGuildEventAuditLogs(eventId)
        return { ...event, currentUserCharacters, auditLogs }
      } catch (err) {
        console.error("Error fetching auditLogs in getGuildEventModalDetails:", err)
      }
    }

    return { ...event, currentUserCharacters }
  } catch (err) {
    console.error("Error in getGuildEventModalDetails:", err)
    return null
  }
}


