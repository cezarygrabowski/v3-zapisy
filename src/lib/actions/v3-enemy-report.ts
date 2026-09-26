"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { getDb, isUniqueViolation } from "@/lib/db"
import {
  guildEvents,
  guildEventSignups,
  guildEventEnemyReports,
  guildEventAuditLogs,
} from "@/lib/db/schema"
import { warsawWallToDate } from "@/lib/dates"
import { requireUser } from "@/lib/session"
import type { GuildEventEnemyReportStatus } from "@/lib/calendar-types"

type ActionResponse<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string }

export async function calculateV3EnemyRaidStatus({
  event,
  participantUserIds,
  reports,
  currentUserId,
  now = new Date(),
}: {
  event: {
    date: string
    startTime: string
    endTime?: string | null
    durationHours?: number | null
    feeWaived: boolean
    feeWaivedReason: string | null
    type: string
  }
  participantUserIds: Set<string>
  reports: { userId: string; createdAt: Date | string }[]
  currentUserId?: string | null
  now?: Date
}): Promise<GuildEventEnemyReportStatus> {
  const hms = event.startTime.length === 5 ? `${event.startTime}:00` : event.startTime
  const startDate = warsawWallToDate(event.date, hms)
  const waiverDeadlineDate = startDate ? new Date(startDate.getTime() + 2 * 60 * 60 * 1000) : null

  let durationHours = event.durationHours || 3
  if (event.startTime && event.endTime) {
    const { calculateDurationHours } = await import("@/lib/calendar-types")
    durationHours = calculateDurationHours(event.startTime, event.endTime)
  }
  const eventEndDate = startDate ? new Date(startDate.getTime() + durationHours * 60 * 60 * 1000) : null

  const nowMs = now.getTime()
  const windowStarted = startDate ? nowMs >= startDate.getTime() : false
  const eventExpired = eventEndDate ? nowMs > eventEndDate.getTime() : false
  const waiverWindowExpired = waiverDeadlineDate ? nowMs > waiverDeadlineDate.getTime() : false

  // Qualified reports: submitted by registered participants within [startDate, waiverDeadlineDate] (first 2h)
  const qualifiedReports = reports.filter((r) => {
    if (!participantUserIds.has(r.userId)) return false
    if (!startDate || !waiverDeadlineDate) return false
    const rTime = new Date(r.createdAt).getTime()
    return rTime >= startDate.getTime() && rTime <= waiverDeadlineDate.getTime()
  })

  // All event reports: submitted by registered participants anytime during the event
  const allEventReports = reports.filter((r) => {
    if (!participantUserIds.has(r.userId)) return false
    if (!startDate) return false
    const rTime = new Date(r.createdAt).getTime()
    return rTime >= startDate.getTime() && (!eventEndDate || rTime <= eventEndDate.getTime())
  })

  const totalParticipants = participantUserIds.size
  const reportsCount = qualifiedReports.length
  const totalReportsCount = allEventReports.length
  const thresholdPassed = totalParticipants > 0 && reportsCount / totalParticipants > 0.5

  const userHasReported = Boolean(
    currentUserId && reports.some((r) => r.userId === currentUserId)
  )

  const isUserParticipant = Boolean(currentUserId && participantUserIds.has(currentUserId))
  const canReport = Boolean(
    event.type === "v3" &&
    isUserParticipant &&
    windowStarted &&
    !eventExpired
  )

  const isWaived = event.feeWaived || thresholdPassed

  return {
    isWaived,
    feeWaivedReason:
      event.feeWaivedReason ??
      (thresholdPassed ? "Wróg na V3 (ponad 50% zgłoszeń uczestników w ciągu pierwszych 2h)" : null),
    reportsCount,
    totalReportsCount,
    totalParticipants,
    thresholdPassed,
    userHasReported,
    canReport,
    windowStarted,
    windowExpired: eventExpired,
    waiverWindowExpired,
    deadlineIso: waiverDeadlineDate ? waiverDeadlineDate.toISOString() : null,
    eventEndIso: eventEndDate ? eventEndDate.toISOString() : null,
  }
}

export async function reportV3EnemyRaid(input: {
  eventId: string
  reason?: string
}): Promise<ActionResponse<{ isWaived: boolean; reportsCount: number; totalParticipants: number }>> {
  const user = await requireUser()
  const db = await getDb()

  const [event] = await db
    .select({
      id: guildEvents.id,
      title: guildEvents.title,
      type: guildEvents.type,
      date: guildEvents.date,
      startTime: guildEvents.startTime,
      endTime: guildEvents.endTime,
      durationHours: guildEvents.durationHours,
      feeWaived: guildEvents.feeWaived,
      feeWaivedReason: guildEvents.feeWaivedReason,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, input.eventId))

  if (!event) {
    return { ok: false, error: "Nie znaleziono wydarzenia." }
  }

  if (event.type !== "v3") {
    return { ok: false, error: "Zgłaszanie wroga jest dostępne wyłącznie dla wydarzeń V3." }
  }

  const hms = event.startTime.length === 5 ? `${event.startTime}:00` : event.startTime
  const startDate = warsawWallToDate(event.date, hms)
  if (!startDate) {
    return { ok: false, error: "Nieprawidłowa data lub godzina rozpoczęcia wydarzenia." }
  }

  let durationHours = event.durationHours || 3
  if (event.startTime && event.endTime) {
    const { calculateDurationHours } = await import("@/lib/calendar-types")
    durationHours = calculateDurationHours(event.startTime, event.endTime)
  }
  const eventEndDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000)

  const now = new Date()

  if (now.getTime() < startDate.getTime()) {
    return { ok: false, error: "Zgłoszenie wroga jest możliwe dopiero po rozpoczęciu wydarzenia." }
  }

  if (now.getTime() > eventEndDate.getTime()) {
    return {
      ok: false,
      error: "Wydarzenie zostało już zakończone – czas na zgłaszanie wroga minął.",
    }
  }

  // Check if user is signed up for this event
  const signups = await db
    .select({ userId: guildEventSignups.userId })
    .from(guildEventSignups)
    .where(eq(guildEventSignups.eventId, input.eventId))

  const participantUserIds = new Set(signups.map((s) => s.userId))
  if (!participantUserIds.has(user.id)) {
    return {
      ok: false,
      error: "Tylko zapisani uczestnicy tego wydarzenia mogą zgłosić obecność wroga.",
    }
  }

  // Insert or ignore report
  try {
    await db.insert(guildEventEnemyReports).values({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      userId: user.id,
      reason: input.reason || "nie da sie dropić, wróg na vce",
      createdAt: now,
    })
  } catch (err) {
    if (!isUniqueViolation(err)) {
      console.error("[reportV3EnemyRaid] Insert error:", err)
      return { ok: false, error: "Wystąpił błąd podczas zapisywania zgłoszenia." }
    }
  }

  // Recalculate status
  const allReports = await db
    .select({
      userId: guildEventEnemyReports.userId,
      createdAt: guildEventEnemyReports.createdAt,
    })
    .from(guildEventEnemyReports)
    .where(eq(guildEventEnemyReports.eventId, input.eventId))

  const status = await calculateV3EnemyRaidStatus({
    event,
    participantUserIds,
    reports: allReports,
    currentUserId: user.id,
    now,
  })

  // If threshold passed (>50%), update guildEvents
  if (status.thresholdPassed && !event.feeWaived) {
    await db
      .update(guildEvents)
      .set({
        feeWaived: true,
        feeWaivedReason: "Wróg na V3 (ponad 50% zgłoszeń uczestników w ciągu pierwszych 2h)",
      })
      .where(eq(guildEvents.id, input.eventId))

    try {
      await db.insert(guildEventAuditLogs).values({
        id: crypto.randomUUID(),
        eventId: input.eventId,
        action: "enemy_raid_reported",
        actorId: user.id,
        targetUserId: null,
        spot: null,
        role: null,
        reason: "Próg >50% zgłoszeń w pierwszych 2h",
        details: `${status.reportsCount}/${status.totalParticipants} zgłoszeń - składka zniesiona`,
      })
    } catch (logErr) {
      console.error("[reportV3EnemyRaid] Audit log error:", logErr)
    }
  }

  revalidatePath("/panel")
  revalidatePath("/kalendarz")
  revalidatePath("/skladki")

  const message = status.isWaived
    ? "Zgłoszono obecność wroga. Ponad 50% uczestników zgłosiło problem w pierwszych 2h – za ten slot nie pobieramy składki!"
    : status.waiverWindowExpired
      ? `Zgłoszono obecność wroga (${status.totalReportsCount}/${status.totalParticipants} uczestników). Zgłoszenie w ostatniej godzinie informuje o problemie, ale nie zwalnia ze składki.`
      : `Zgłoszono obecność wroga (${status.reportsCount}/${status.totalParticipants} uczestników). Wymagane ponad 50% w ciągu pierwszych 2h, aby znieść składkę.`

  return {
    ok: true,
    data: {
      isWaived: status.isWaived,
      reportsCount: status.reportsCount,
      totalParticipants: status.totalParticipants,
    },
    message,
  }
}

export async function retractV3EnemyReport(input: {
  eventId: string
}): Promise<ActionResponse<{ isWaived: boolean; reportsCount: number; totalParticipants: number }>> {
  const user = await requireUser()
  const db = await getDb()

  const [event] = await db
    .select({
      id: guildEvents.id,
      title: guildEvents.title,
      type: guildEvents.type,
      date: guildEvents.date,
      startTime: guildEvents.startTime,
      endTime: guildEvents.endTime,
      durationHours: guildEvents.durationHours,
      feeWaived: guildEvents.feeWaived,
      feeWaivedReason: guildEvents.feeWaivedReason,
    })
    .from(guildEvents)
    .where(eq(guildEvents.id, input.eventId))

  if (!event) {
    return { ok: false, error: "Nie znaleziono wydarzenia." }
  }

  await db
    .delete(guildEventEnemyReports)
    .where(
      and(
        eq(guildEventEnemyReports.eventId, input.eventId),
        eq(guildEventEnemyReports.userId, user.id)
      )
    )

  const signups = await db
    .select({ userId: guildEventSignups.userId })
    .from(guildEventSignups)
    .where(eq(guildEventSignups.eventId, input.eventId))

  const participantUserIds = new Set(signups.map((s) => s.userId))

  const allReports = await db
    .select({
      userId: guildEventEnemyReports.userId,
      createdAt: guildEventEnemyReports.createdAt,
    })
    .from(guildEventEnemyReports)
    .where(eq(guildEventEnemyReports.eventId, input.eventId))

  const status = await calculateV3EnemyRaidStatus({
    event,
    participantUserIds,
    reports: allReports,
    currentUserId: user.id,
    now: new Date(),
  })

  // If threshold dropped and it was waived due to reports, reset feeWaived
  if (
    !status.thresholdPassed &&
    event.feeWaived &&
    event.feeWaivedReason?.includes("Wróg na V3")
  ) {
    await db
      .update(guildEvents)
      .set({
        feeWaived: false,
        feeWaivedReason: null,
      })
      .where(eq(guildEvents.id, input.eventId))
  }

  revalidatePath("/panel")
  revalidatePath("/kalendarz")
  revalidatePath("/skladki")

  return {
    ok: true,
    data: {
      isWaived: status.isWaived,
      reportsCount: status.reportsCount,
      totalParticipants: status.totalParticipants,
    },
    message: "Cofnięto zgłoszenie obecności wroga.",
  }
}

export async function adminToggleFeeWaived(input: {
  eventId: string
  waived: boolean
  reason?: string
}): Promise<ActionResponse<{ isWaived: boolean }>> {
  const user = await requireUser()
  if (!user.isLeader) {
    return { ok: false, error: "Brak uprawnień lidera." }
  }

  const db = await getDb()

  const [event] = await db
    .select({ id: guildEvents.id })
    .from(guildEvents)
    .where(eq(guildEvents.id, input.eventId))

  if (!event) {
    return { ok: false, error: "Nie znaleziono wydarzenia." }
  }

  const feeWaivedReason = input.waived
    ? input.reason || "Decyzja lidera: zwolnienie ze składki (wróg na V3)"
    : null

  await db
    .update(guildEvents)
    .set({
      feeWaived: input.waived,
      feeWaivedReason,
    })
    .where(eq(guildEvents.id, input.eventId))

  try {
    await db.insert(guildEventAuditLogs).values({
      id: crypto.randomUUID(),
      eventId: input.eventId,
      action: "fee_waived_toggled",
      actorId: user.id,
      targetUserId: null,
      spot: null,
      role: null,
      reason: input.waived ? "Ręczne zwolnienie ze składki" : "Przywrócenie składki",
      details: feeWaivedReason || undefined,
    })
  } catch (err) {
    console.error("[adminToggleFeeWaived] Audit log error:", err)
  }

  revalidatePath("/panel")
  revalidatePath("/kalendarz")
  revalidatePath("/skladki")

  return {
    ok: true,
    data: { isWaived: input.waived },
    message: input.waived ? "Składka za ten slot została zniesiona." : "Składka została przywrócona.",
  }
}
