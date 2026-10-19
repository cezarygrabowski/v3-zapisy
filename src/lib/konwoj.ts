import { and, asc, eq, gte, lte, ne } from "drizzle-orm"
import { getDb } from "@/lib/db"
import {
  guildEvents,
  guildEventSignups,
  konwojGroupMembers,
  konwojGroups,
  konwojPayouts,
  konwojPrices,
  konwojWeeks,
  users,
} from "@/lib/db/schema"
import { weekEndForStart } from "@/lib/dates"

export type KonwojShare = {
  userId: string
  gameNick: string
  runs: number
  percentage: number
  shareKk: number
  paid: boolean
}

/** Splits the weekly pool proportionally to runs; shares are floored to whole kk, leftover stays in the group. */
export function splitKonwojPool(
  poolKk: number,
  players: { userId: string; gameNick: string; runs: number }[],
  paidUserIds: Set<string> = new Set()
): { shares: KonwojShare[]; totalRuns: number; leftoverKk: number } {
  const totalRuns = players.reduce((sum, p) => sum + p.runs, 0)
  const shares = players
    .map((p) => ({
      userId: p.userId,
      gameNick: p.gameNick,
      runs: p.runs,
      percentage: totalRuns > 0 ? Math.round((p.runs / totalRuns) * 1000) / 10 : 0,
      shareKk: totalRuns > 0 ? Math.floor((poolKk * p.runs) / totalRuns) : 0,
      paid: paidUserIds.has(p.userId),
    }))
    .sort((a, b) => b.runs - a.runs || a.gameNick.localeCompare(b.gameNick, "pl"))
  const leftoverKk = Math.round((poolKk - shares.reduce((sum, s) => sum + s.shareKk, 0)) * 100) / 100
  return { shares, totalRuns, leftoverKk }
}

export type KonwojPrice = {
  id: string
  name: string
  marketPriceKk: number | null
  guildPriceKk: number | null
}

export type KonwojGroup = {
  id: string
  name: string
  members: { userId: string; gameNick: string; isTreasurer: boolean }[]
}

export async function listKonwojGroups(): Promise<KonwojGroup[]> {
  const db = await getDb()
  const [groups, members] = await Promise.all([
    db.select().from(konwojGroups).orderBy(asc(konwojGroups.name)),
    db
      .select({
        groupId: konwojGroupMembers.groupId,
        userId: users.id,
        gameNick: users.gameNick,
        isTreasurer: konwojGroupMembers.isTreasurer,
      })
      .from(konwojGroupMembers)
      .innerJoin(users, eq(users.id, konwojGroupMembers.userId))
      .orderBy(asc(users.gameNick)),
  ])
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    members: members.filter((m) => m.groupId === g.id).map((m) => ({ userId: m.userId, gameNick: m.gameNick, isTreasurer: m.isTreasurer })),
  }))
}

export function canManageKonwojGroup(user: { id: string; isLeader: boolean }, group: { members: { userId: string; isTreasurer: boolean }[] }) {
  return user.isLeader || group.members.some((m) => m.userId === user.id && m.isTreasurer)
}

export type KonwojRun = {
  id: string
  title: string
  date: string
  startTime: string
  status: string
  signups: number
  attended: number
  horses: number
}

export async function getKonwojWeek(group: KonwojGroup, weekStart: string) {
  const db = await getDb()
  const weekEnd = weekEndForStart(weekStart)

  const [rows, [week], payouts] = await Promise.all([
    db
      .select({
        eventId: guildEvents.id,
        title: guildEvents.title,
        date: guildEvents.date,
        startTime: guildEvents.startTime,
        status: guildEvents.status,
        userId: guildEventSignups.userId,
        gameNick: users.gameNick,
        attended: guildEventSignups.attended,
        hasHorse: guildEventSignups.hasHorse,
      })
      .from(guildEvents)
      .leftJoin(guildEventSignups, eq(guildEventSignups.eventId, guildEvents.id))
      .leftJoin(users, eq(users.id, guildEventSignups.userId))
      .where(
        and(
          eq(guildEvents.type, "konwoj"),
          eq(guildEvents.konwojGroupId, group.id),
          ne(guildEvents.status, "cancelled"),
          gte(guildEvents.date, weekStart),
          lte(guildEvents.date, weekEnd)
        )
      )
      .orderBy(asc(guildEvents.date), asc(guildEvents.startTime)),
    db
      .select()
      .from(konwojWeeks)
      .where(and(eq(konwojWeeks.groupId, group.id), eq(konwojWeeks.weekStart, weekStart))),
    db
      .select({ userId: konwojPayouts.userId })
      .from(konwojPayouts)
      .where(and(eq(konwojPayouts.groupId, group.id), eq(konwojPayouts.weekStart, weekStart))),
  ])

  const runs = new Map<string, KonwojRun>()
  // Only current members share the pool, whenever they were assigned: their earlier runs this week count too.
  // Every member is listed (0 runs = 0 kk); a player with two characters in one run still counts once.
  const userRuns = new Map(group.members.map((m) => [m.userId, { gameNick: m.gameNick, eventIds: new Set<string>() }]))
  const unassignedRuns = new Map<string, { gameNick: string; eventIds: Set<string> }>()

  for (const row of rows) {
    const run =
      runs.get(row.eventId) ??
      runs
        .set(row.eventId, {
          id: row.eventId,
          title: row.title,
          date: row.date,
          startTime: row.startTime,
          status: row.status,
          signups: 0,
          attended: 0,
          horses: 0,
        })
        .get(row.eventId)!
    if (!row.userId) continue
    run.signups++
    if (row.hasHorse) run.horses++
    if (!row.attended) continue
    run.attended++
    const target = userRuns.has(row.userId) ? userRuns : unassignedRuns
    const entry = target.get(row.userId) ?? { gameNick: row.gameNick ?? "Gracz", eventIds: new Set<string>() }
    entry.eventIds.add(row.eventId)
    target.set(row.userId, entry)
  }

  const shopYangKk = week?.shopYangKk ?? 0
  const itemsValueKk = week?.shopItemsValueKk ?? 0
  const poolKk = shopYangKk + itemsValueKk
  const players = [...userRuns].map(([userId, v]) => ({ userId, gameNick: v.gameNick, runs: v.eventIds.size }))
  const split = splitKonwojPool(poolKk, players, new Set(payouts.map((p) => p.userId)))

  // Attended this group's runs but not assigned to it yet: not paid until the admin assigns them.
  const unassigned = [...unassignedRuns].map(([userId, v]) => ({ userId, gameNick: v.gameNick, runs: v.eventIds.size }))

  const collectorName = week?.collectorName ?? null
  return {
    weekStart,
    weekEnd,
    collectorName,
    shopYangKk,
    itemsValueKk,
    poolKk,
    runs: [...runs.values()],
    unassigned,
    ...split,
  }
}

export async function listKonwojPrices(groupId: string): Promise<KonwojPrice[]> {
  const db = await getDb()
  return db
    .select({
      id: konwojPrices.id,
      name: konwojPrices.name,
      marketPriceKk: konwojPrices.marketPriceKk,
      guildPriceKk: konwojPrices.guildPriceKk,
    })
    .from(konwojPrices)
    .where(eq(konwojPrices.groupId, groupId))
    .orderBy(asc(konwojPrices.name))
}
