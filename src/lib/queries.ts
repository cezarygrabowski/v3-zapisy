import { and, desc, eq, gte, inArray } from "drizzle-orm"
import {
  POSITIONS,
  SLOTS,
  type Playstyle,
  type PositionId,
  type SlotId,
} from "@/lib/constants"
import { getDb } from "@/lib/db"
import {
  feePayments,
  runKillHelpers,
  runKills,
  runSyncs,
  signups,
  users,
  type User,
} from "@/lib/db/schema"
import { buildFeeLedger, type FeeCharge, type UserFeeState } from "@/lib/fees"

export type GridSignup = {
  id: string
  userId: string
  gameNick: string
  playstyle: Playstyle | null
  paid: boolean
  feeKk: number
}

export async function getDayGrid(date: string) {
  const db = await getDb()
  const rows = await db
    .select({
      id: signups.id,
      date: signups.date,
      slot: signups.slot,
      position: signups.position,
      userId: signups.userId,
      feeKk: signups.feeKk,
      paid: signups.paid,
      gameNick: users.gameNick,
      playstyle: users.playstyle,
    })
    .from(signups)
    .innerJoin(users, eq(signups.userId, users.id))
    .where(eq(signups.date, date))

  const byCell = new Map<string, GridSignup>()
  let mine: GridSignup & { slot: SlotId; position: PositionId } | null = null

  for (const row of rows) {
    const cell: GridSignup = {
      id: row.id,
      userId: row.userId,
      gameNick: row.gameNick,
      playstyle: (row.playstyle as Playstyle | null) ?? null,
      paid: row.paid,
      feeKk: row.feeKk,
    }
    byCell.set(`${row.slot}:${row.position}`, cell)
  }

  return {
    date,
    cells: SLOTS.flatMap((slot) =>
      POSITIONS.map((position) => ({
        slot: slot.id,
        position: position.id,
        signup: byCell.get(`${slot.id}:${position.id}`) ?? null,
      }))
    ),
    findMine(userId: string) {
      for (const row of rows) {
        if (row.userId === userId) {
          mine = {
            id: row.id,
            userId: row.userId,
            gameNick: row.gameNick,
            playstyle: (row.playstyle as Playstyle | null) ?? null,
            paid: row.paid,
            feeKk: row.feeKk,
            slot: row.slot as SlotId,
            position: row.position as PositionId,
          }
          return mine
        }
      }
      return null
    },
  }
}

export async function listUsers(): Promise<User[]> {
  const db = await getDb()
  return db.select().from(users).orderBy(users.gameNick)
}

export async function getFeeLedger(): Promise<Map<string, UserFeeState>> {
  const db = await getDb()
  const chargeRows = await db
    .select({
      userId: users.id,
      gameNick: users.gameNick,
      playstyle: users.playstyle,
      date: signups.date,
      slot: signups.slot,
      position: signups.position,
      feeKk: signups.feeKk,
    })
    .from(signups)
    .innerJoin(users, eq(signups.userId, users.id))
    .where(eq(signups.paid, false))

  const charges: FeeCharge[] = chargeRows.map((row) => ({
    userId: row.userId,
    gameNick: row.gameNick,
    playstyle: (row.playstyle as Playstyle | null) ?? null,
    date: row.date,
    slot: row.slot as SlotId,
    position: row.position as PositionId,
    feeKk: row.feeKk,
  }))

  const credits = await db
    .select({
      userId: feePayments.userId,
      amountKk: feePayments.amountKk,
    })
    .from(feePayments)
    .where(eq(feePayments.status, "confirmed"))

  return buildFeeLedger(charges, credits)
}

export type PendingFeePayment = {
  id: string
  userId: string
  gameNick: string
  amountKk: number
  createdAt: string
}

export type FeePaymentHistoryItem = {
  id: string
  userId: string
  gameNick: string
  amountKk: number
  status: "confirmed" | "rejected"
  reportedByNick: string
  confirmedByNick: string | null
  createdAt: string
  resolvedAt: string | null
}

export async function listPendingPayments(): Promise<PendingFeePayment[]> {
  const db = await getDb()
  const rows = await db
    .select({
      id: feePayments.id,
      userId: feePayments.userId,
      gameNick: users.gameNick,
      amountKk: feePayments.amountKk,
      createdAt: feePayments.createdAt,
    })
    .from(feePayments)
    .innerJoin(users, eq(feePayments.userId, users.id))
    .where(eq(feePayments.status, "pending"))
    .orderBy(desc(feePayments.createdAt))

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    gameNick: row.gameNick,
    amountKk: row.amountKk,
    createdAt: new Date(row.createdAt).toISOString(),
  }))
}

export async function countPendingPayments(): Promise<number> {
  const pending = await listPendingPayments()
  return pending.length
}

export async function listPaymentHistory(limit = 20): Promise<FeePaymentHistoryItem[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(feePayments)
    .where(inArray(feePayments.status, ["confirmed", "rejected"]))
    .orderBy(desc(feePayments.resolvedAt), desc(feePayments.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  const nickRows = await db.select({ id: users.id, gameNick: users.gameNick }).from(users)
  const nickById = new Map(nickRows.map((row) => [row.id, row.gameNick]))

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    gameNick: nickById.get(row.userId) ?? "?",
    amountKk: row.amountKk,
    status: row.status === "rejected" ? "rejected" : "confirmed",
    reportedByNick: nickById.get(row.reportedBy) ?? "?",
    confirmedByNick: row.confirmedBy ? (nickById.get(row.confirmedBy) ?? "?") : null,
    createdAt: new Date(row.createdAt).toISOString(),
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
  }))
}

export function emptyFeeState(userId: string, gameNick: string, playstyle: Playstyle | null): UserFeeState {
  return {
    userId,
    gameNick,
    playstyle,
    overdueKk: 0,
    currentWeekRemainingKk: 0,
    overdueWeeks: [],
    currentWeek: null,
    settledWeeks: [],
  }
}

export type StatsRow = {
  userId: string
  gameNick: string
  playstyle: Playstyle | null
  entries: number
  owedKk: number
  byPosition: Record<PositionId, number>
}

export async function listStats(fromDate: string | null): Promise<StatsRow[]> {
  const db = await getDb()
  const rows = await db
    .select({
      userId: users.id,
      gameNick: users.gameNick,
      playstyle: users.playstyle,
      position: signups.position,
    })
    .from(signups)
    .innerJoin(users, eq(signups.userId, users.id))
    .where(fromDate ? gte(signups.date, fromDate) : undefined)

  const map = new Map<string, StatsRow>()
  for (const row of rows) {
    let stats = map.get(row.userId)
    if (!stats) {
      stats = {
        userId: row.userId,
        gameNick: row.gameNick,
        playstyle: (row.playstyle as Playstyle | null) ?? null,
        entries: 0,
        owedKk: 0,
        byPosition: {
          R1: 0,
          R2: 0,
          R3: 0,
          PRAWO: 0,
          R1_KORYTARZ: 0,
          PRAWO_KORYTARZ: 0,
        },
      }
      map.set(row.userId, stats)
    }
    stats.entries += 1
    const position = row.position as PositionId
    if (position in stats.byPosition) {
      stats.byPosition[position] += 1
    }
  }

  const ledger = await getFeeLedger()
  for (const stats of map.values()) {
    stats.owedKk = ledger.get(stats.userId)?.overdueKk ?? 0
  }

  return [...map.values()].sort((a, b) => b.entries - a.entries || a.gameNick.localeCompare(b.gameNick, "pl"))
}

export type RosterMember = {
  position: PositionId
  userId: string | null
  gameNick: string | null
}

export async function getSlotRoster(date: string, slot: SlotId): Promise<RosterMember[]> {
  const db = await getDb()
  const rows = await db
    .select({
      position: signups.position,
      userId: users.id,
      gameNick: users.gameNick,
    })
    .from(signups)
    .innerJoin(users, eq(signups.userId, users.id))
    .where(and(eq(signups.date, date), eq(signups.slot, slot)))

  const byPosition = new Map(rows.map((row) => [row.position, row]))
  return POSITIONS.map((position) => {
    const row = byPosition.get(position.id)
    return {
      position: position.id,
      userId: row?.userId ?? null,
      gameNick: row?.gameNick ?? null,
    }
  })
}

export type KillLogItem = {
  id: string
  kind: "queen" | "baron"
  reportedBy: string
  reporterNick: string
  killedAtLabel: string
  killedAt: string
  helperNicks: string[]
}

export async function listKillsForDate(date: string): Promise<KillLogItem[]> {
  const db = await getDb()
  const kills = await db
    .select({
      id: runKills.id,
      kind: runKills.kind,
      reportedBy: runKills.reportedBy,
      reporterNick: users.gameNick,
      killedAtLabel: runKills.killedAtLabel,
      killedAt: runKills.killedAt,
    })
    .from(runKills)
    .innerJoin(users, eq(runKills.reportedBy, users.id))
    .where(eq(runKills.date, date))
    .orderBy(desc(runKills.killedAt))

  if (kills.length === 0) return []

  const helpers = await db
    .select({
      killId: runKillHelpers.killId,
      gameNick: users.gameNick,
    })
    .from(runKillHelpers)
    .innerJoin(users, eq(runKillHelpers.userId, users.id))
    .where(
      inArray(
        runKillHelpers.killId,
        kills.map((kill) => kill.id)
      )
    )

  const helpersByKill = new Map<string, string[]>()
  for (const helper of helpers) {
    const list = helpersByKill.get(helper.killId) ?? []
    list.push(helper.gameNick)
    helpersByKill.set(helper.killId, list)
  }

  return kills.map((kill) => ({
    id: kill.id,
    kind: kill.kind === "baron" ? "baron" : "queen",
    reportedBy: kill.reportedBy,
    reporterNick: kill.reporterNick,
    killedAtLabel: kill.killedAtLabel,
    killedAt: new Date(kill.killedAt).toISOString(),
    helperNicks: (helpersByKill.get(kill.id) ?? []).sort((a, b) => a.localeCompare(b, "pl")),
  }))
}

export type KillStatsRow = {
  userId: string
  gameNick: string
  queens: number
  barons: number
}

export type RunSyncState = {
  kind: string
  syncedAt: string
  syncedAtLabel: string
}

export async function listRunSyncs(): Promise<RunSyncState[]> {
  const db = await getDb()
  const rows = await db.select().from(runSyncs)
  return rows.map((row) => ({
    kind: row.kind,
    syncedAt: new Date(row.syncedAt).toISOString(),
    syncedAtLabel: row.syncedAtLabel,
  }))
}

export async function listKillStats(fromDate: string | null): Promise<KillStatsRow[]> {
  const db = await getDb()
  const kills = await db
    .select({
      id: runKills.id,
      kind: runKills.kind,
      reportedBy: runKills.reportedBy,
      date: runKills.date,
    })
    .from(runKills)
    .where(fromDate ? gte(runKills.date, fromDate) : undefined)

  if (kills.length === 0) return []

  const helpers = await db
    .select({
      killId: runKillHelpers.killId,
      userId: runKillHelpers.userId,
    })
    .from(runKillHelpers)
    .where(
      inArray(
        runKillHelpers.killId,
        kills.map((kill) => kill.id)
      )
    )

  const helpersByKill = new Map<string, string[]>()
  for (const helper of helpers) {
    const list = helpersByKill.get(helper.killId) ?? []
    list.push(helper.userId)
    helpersByKill.set(helper.killId, list)
  }

  const nicks = await db.select({ id: users.id, gameNick: users.gameNick }).from(users)
  const nickById = new Map(nicks.map((user) => [user.id, user.gameNick]))

  const map = new Map<string, KillStatsRow>()
  function rowFor(userId: string) {
    let row = map.get(userId)
    if (!row) {
      row = {
        userId,
        gameNick: nickById.get(userId) ?? "?",
        queens: 0,
        barons: 0,
      }
      map.set(userId, row)
    }
    return row
  }

  for (const kill of kills) {
    if (kill.kind === "queen") {
      rowFor(kill.reportedBy).queens += 1
      continue
    }
    const involved = new Set([kill.reportedBy, ...(helpersByKill.get(kill.id) ?? [])])
    for (const userId of involved) {
      rowFor(userId).barons += 1
    }
  }

  return [...map.values()].sort(
    (a, b) => b.queens - a.queens || b.barons - a.barons || a.gameNick.localeCompare(b.gameNick, "pl")
  )
}
