import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm"
import {
  calculateDurationHours,
  computeEventEffectiveStatus,
  type EventDetails,
  type EventSignupEntry,
  type GuildEventListItem,
  type GuildEventType,
} from "@/lib/calendar-types"
import { getDb } from "@/lib/db"
import { guildEventAuditLogs, guildEventSignups, guildEvents, users } from "@/lib/db/schema"
import { getExpeditionHourBlocks } from "@/lib/red-las"
import { addDays, pad, todayInWarsaw, warsawMinutes } from "@/lib/dates"
import { alias } from "drizzle-orm/pg-core"

export * from "@/lib/calendar-types"

export async function listGuildEvents(options?: {
  startDate?: string
  endDate?: string
  limit?: number
  currentUserId?: string
}): Promise<GuildEventListItem[]> {
  const db = await getDb()

  const conditions = []
  if (options?.startDate) conditions.push(gte(guildEvents.date, options.startDate))
  if (options?.endDate) conditions.push(lte(guildEvents.date, options.endDate))

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      id: guildEvents.id,
      title: guildEvents.title,
      type: guildEvents.type,
      date: guildEvents.date,
      startTime: guildEvents.startTime,
      endTime: guildEvents.endTime,
      durationHours: guildEvents.durationHours,
      signupMode: guildEvents.signupMode,
      recurrence: guildEvents.recurrence,
      color: guildEvents.color,
      maxParticipants: guildEvents.maxParticipants,
      description: guildEvents.description,
      status: guildEvents.status,
      createdById: guildEvents.createdBy,
      createdByNick: users.gameNick,
      createdAt: guildEvents.createdAt,
    })
    .from(guildEvents)
    .innerJoin(users, eq(guildEvents.createdBy, users.id))
    .where(whereClause)
    .orderBy(asc(guildEvents.date), asc(guildEvents.startTime))
    .limit(options?.limit ?? 500)

  if (rows.length === 0) return []

  const eventIds = rows.map((r) => r.id)
  const signups = await db
    .select({
      id: guildEventSignups.id,
      eventId: guildEventSignups.eventId,
      userId: guildEventSignups.userId,
      spot: guildEventSignups.spot,
      role: guildEventSignups.role,
    })
    .from(guildEventSignups)
    .where(inArray(guildEventSignups.eventId, eventIds))

  const signupsByEvent = new Map<
    string,
    {
      total: number
      userSet: Set<string>
      mySignup?: { signupId: string; spot: string | null; role: string | null }
    }
  >()

  for (const s of signups) {
    let stat = signupsByEvent.get(s.eventId)
    if (!stat) {
      stat = { total: 0, userSet: new Set() }
      signupsByEvent.set(s.eventId, stat)
    }
    stat.total += 1
    stat.userSet.add(s.userId)

    if (options?.currentUserId && s.userId === options.currentUserId) {
      stat.mySignup = {
        signupId: s.id,
        spot: s.spot,
        role: s.role,
      }
    }
  }

  return rows.map((r) => {
    const stats = signupsByEvent.get(r.id)
    const computedDuration = r.endTime ? calculateDurationHours(r.startTime, r.endTime) : (r.durationHours || 1)
    return {
      id: r.id,
      title: r.title,
      type: (r.type as GuildEventType) || "other",
      color: r.color || "blue",
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      durationHours: computedDuration,
      signupMode: r.signupMode || "spots",
      recurrence: r.recurrence || "none",
      maxParticipants: r.maxParticipants,
      description: r.description,
      status: computeEventEffectiveStatus(
        r.status,
        r.date,
        r.startTime,
        computedDuration
      ),
      createdById: r.createdById,
      createdByNick: r.createdByNick,
      createdAt: new Date(r.createdAt).toISOString(),
      totalSignups: stats?.total ?? 0,
      uniqueUsersCount: stats?.userSet.size ?? 0,
      mySignup: stats?.mySignup ?? null,
    }
  })
}

export async function getGuildEventDetails(eventId: string): Promise<EventDetails | null> {
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
      signupMode: guildEvents.signupMode,
      recurrence: guildEvents.recurrence,
      color: guildEvents.color,
      maxParticipants: guildEvents.maxParticipants,
      description: guildEvents.description,
      status: guildEvents.status,
      createdById: guildEvents.createdBy,
      createdByNick: users.gameNick,
      createdAt: guildEvents.createdAt,
    })
    .from(guildEvents)
    .innerJoin(users, eq(guildEvents.createdBy, users.id))
    .where(eq(guildEvents.id, eventId))

  if (!event) return null

  const signupsRows = await db
    .select({
      signupId: guildEventSignups.id,
      userId: guildEventSignups.userId,
      hourIndex: guildEventSignups.hourIndex,
      spot: guildEventSignups.spot,
      role: guildEventSignups.role,
      attended: guildEventSignups.attended,
      gameNick: users.gameNick,
      createdAt: guildEventSignups.createdAt,
    })
    .from(guildEventSignups)
    .innerJoin(users, eq(guildEventSignups.userId, users.id))
    .where(eq(guildEventSignups.eventId, eventId))
    .orderBy(users.gameNick)

  const entries: EventSignupEntry[] = signupsRows.map((s) => ({
    signupId: s.signupId,
    userId: s.userId,
    gameNick: s.gameNick,
    hourIndex: s.hourIndex,
    spot: s.spot,
    role: s.role,
    attended: s.attended,
    createdAt: new Date(s.createdAt).toISOString(),
  }))

  const hourBlocks = getExpeditionHourBlocks(event.startTime, event.durationHours)
  const hourSlots = hourBlocks.map((block) => ({
    block,
    signups: entries.filter((s) => s.hourIndex === block.index),
  }))

  const participantMap = new Map<string, { userId: string; gameNick: string; count: number; attendedCount: number }>()
  for (const s of entries) {
    let p = participantMap.get(s.userId)
    if (!p) {
      p = { userId: s.userId, gameNick: s.gameNick, count: 0, attendedCount: 0 }
      participantMap.set(s.userId, p)
    }
    p.count += 1
    if (s.attended) p.attendedCount += 1
  }

  const allParticipants = [...participantMap.values()].sort(
    (a, b) => b.count - a.count || a.gameNick.localeCompare(b.gameNick, "pl")
  )

  return {
    id: event.id,
    title: event.title,
    type: (event.type as GuildEventType) || "other",
    color: event.color || "blue",
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    durationHours: event.durationHours,
    signupMode: event.signupMode || "spots",
    recurrence: event.recurrence || "none",
    maxParticipants: event.maxParticipants,
    description: event.description,
    status: computeEventEffectiveStatus(
      event.status,
      event.date,
      event.startTime,
      event.durationHours
    ),
    createdById: event.createdById,
    createdByNick: event.createdByNick,
    createdAt: new Date(event.createdAt).toISOString(),
    hourSlots,
    signups: entries,
    allParticipants,
  }
}

export async function getRelevantV3CalendarEvent(now = new Date()): Promise<EventDetails | null> {
  const db = await getDb()
  const today = todayInWarsaw(now)
  const yesterday = addDays(today, -1)
  const tomorrow = addDays(today, 1)

  // Fetch V3 events for yesterday, today, and tomorrow
  const rows = await db
    .select({
      id: guildEvents.id,
      date: guildEvents.date,
      startTime: guildEvents.startTime,
      endTime: guildEvents.endTime,
      durationHours: guildEvents.durationHours,
      status: guildEvents.status,
    })
    .from(guildEvents)
    .where(
      and(
        eq(guildEvents.type, "v3"),
        gte(guildEvents.date, yesterday),
        lte(guildEvents.date, tomorrow)
      )
    )

  if (rows.length === 0) return null

  const currentMinutes = warsawMinutes(now)
  const [cy, cm, cd] = today.split("-").map(Number)
  const currentTotalMins = (Date.UTC(cy, cm - 1, cd) / 60000) + currentMinutes

  type Candidate = {
    id: string
    startTotalMins: number
    endTotalMins: number
    status: "planned" | "active" | "finished" | "cancelled"
  }

  const candidates: Candidate[] = []

  for (const r of rows) {
    if (r.status === "cancelled") continue

    const [ey, em, ed] = r.date.split("-").map(Number)
    const baseDayMins = Date.UTC(ey, em - 1, ed) / 60000
    const [sh, sm] = r.startTime.split(":").map(Number)
    const startMins = (sh || 0) * 60 + (sm || 0)
    const startTotalMins = baseDayMins + startMins

    let durationHours = r.durationHours || 1
    if (r.endTime) {
      durationHours = calculateDurationHours(r.startTime, r.endTime)
    }
    const endTotalMins = startTotalMins + durationHours * 60

    const effectiveStatus = computeEventEffectiveStatus(
      r.status,
      r.date,
      r.startTime,
      durationHours,
      now
    )

    candidates.push({
      id: r.id,
      startTotalMins,
      endTotalMins,
      status: effectiveStatus,
    })
  }

  if (candidates.length === 0) return null

  // 1. Any currently active event?
  const activeCandidate = candidates.find(
    (c) => c.status === "active" || (currentTotalMins >= c.startTotalMins && currentTotalMins < c.endTotalMins)
  )
  if (activeCandidate) {
    return getGuildEventDetails(activeCandidate.id)
  }

  // 2. Next upcoming planned event
  const upcomingCandidates = candidates
    .filter((c) => c.startTotalMins > currentTotalMins)
    .sort((a, b) => a.startTotalMins - b.startTotalMins)

  if (upcomingCandidates.length > 0) {
    return getGuildEventDetails(upcomingCandidates[0].id)
  }

  // 3. Most recently finished event
  const pastCandidates = candidates
    .filter((c) => c.endTotalMins <= currentTotalMins)
    .sort((a, b) => b.endTotalMins - a.endTotalMins)

  if (pastCandidates.length > 0) {
    return getGuildEventDetails(pastCandidates[0].id)
  }

  return null
}

export async function listGuildEventAuditLogs(eventId: string) {
  const db = await getDb()
  const actorUsers = alias(users, "actor_user")
  const targetUsers = alias(users, "target_user")

  const rows = await db
    .select({
      id: guildEventAuditLogs.id,
      eventId: guildEventAuditLogs.eventId,
      action: guildEventAuditLogs.action,
      actorId: guildEventAuditLogs.actorId,
      actorNick: actorUsers.gameNick,
      targetUserId: guildEventAuditLogs.targetUserId,
      targetUserNick: targetUsers.gameNick,
      spot: guildEventAuditLogs.spot,
      role: guildEventAuditLogs.role,
      reason: guildEventAuditLogs.reason,
      details: guildEventAuditLogs.details,
      createdAt: guildEventAuditLogs.createdAt,
    })
    .from(guildEventAuditLogs)
    .innerJoin(actorUsers, eq(guildEventAuditLogs.actorId, actorUsers.id))
    .leftJoin(targetUsers, eq(guildEventAuditLogs.targetUserId, targetUsers.id))
    .where(eq(guildEventAuditLogs.eventId, eventId))
    .orderBy(desc(guildEventAuditLogs.createdAt))

  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    action: r.action as "signup" | "withdraw" | "admin_withdraw" | "admin_assign" | "reschedule" | "edit",
    actorId: r.actorId,
    actorNick: r.actorNick,
    targetUserId: r.targetUserId,
    targetUserNick: r.targetUserNick,
    spot: r.spot,
    role: r.role,
    reason: r.reason,
    details: r.details,
    createdAt: new Date(r.createdAt).toISOString(),
  }))
}

