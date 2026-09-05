import { desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/lib/db"
import {
  customTimerKills,
  customTimers,
  timerCategories,
  users,
} from "@/lib/db/schema"
import { computeChannelStatus, type BossChannelStatus, type RedChannel } from "@/lib/red-las"

export type CustomTimerWithChannels = {
  id: string
  categoryId: string
  name: string
  channelsCount: number
  respawnMinMinutes: number
  respawnMaxMinutes: number
  notes: string | null
  createdById: string
  createdByNick: string
  createdAt: string
  channels: BossChannelStatus[]
}

export type TimerCategoryData = {
  id: string
  name: string
  icon: string
  orderIndex: number
  timers: CustomTimerWithChannels[]
}

const DEFAULT_MAPS = [
  {
    name: "Red Las",
    icon: "🌲",
    orderIndex: 1,
    timers: [
      {
        name: "Władca Drzew (Koniec Lasu)",
        channelsCount: 5,
        respawnMinMinutes: 48,
        respawnMaxMinutes: 52,
        notes: "Boss na końcu lasu z głównym dropem",
      },
    ],
  },
  {
    name: "Świątynia Hwang",
    icon: "⛩️",
    orderIndex: 2,
    timers: [
      {
        name: "Zjawa Żółtego Tygrysa",
        channelsCount: 5,
        respawnMinMinutes: 120,
        respawnMaxMinutes: 120,
        notes: "Przedostatnie piętro świątyni",
      },
    ],
  },
  {
    name: "Ognista Ziemia",
    icon: "🌋",
    orderIndex: 3,
    timers: [
      {
        name: "Ognisty Król",
        channelsCount: 5,
        respawnMinMinutes: 60,
        respawnMaxMinutes: 83,
        notes: "Centrum mapy Ognistej Ziemi",
      },
    ],
  },
  {
    name: "Góra Sohan",
    icon: "❄️",
    orderIndex: 4,
    timers: [
      {
        name: "Dziewięć Ogonów",
        channelsCount: 5,
        respawnMinMinutes: 20,
        respawnMaxMinutes: 35,
        notes: "Okolice środka lodowej góry",
      },
    ],
  },
  {
    name: "Loch Pająków V1",
    icon: "🕸️",
    orderIndex: 5,
    timers: [
      {
        name: "Pająk Bestia",
        channelsCount: 5,
        respawnMinMinutes: 48,
        respawnMaxMinutes: 52,
        notes: "Boss na końcu Lochu Pająków V1",
      },
    ],
  },
]

export async function ensureDefaultTimerCategories(adminUserId: string) {
  const db = await getDb()

  // Idempotent: only insert categories that don't already exist (by name)
  const existingCats = await db
    .select({ id: timerCategories.id, name: timerCategories.name })
    .from(timerCategories)

  const existingNames = new Set(existingCats.map((c) => c.name))

  for (const cat of DEFAULT_MAPS) {
    if (existingNames.has(cat.name)) continue

    const catId = crypto.randomUUID()
    await db.insert(timerCategories).values({
      id: catId,
      name: cat.name,
      icon: cat.icon,
      orderIndex: cat.orderIndex,
      createdBy: adminUserId,
    })

    for (const t of cat.timers) {
      await db.insert(customTimers).values({
        id: crypto.randomUUID(),
        categoryId: catId,
        name: t.name,
        channelsCount: t.channelsCount,
        respawnMinMinutes: t.respawnMinMinutes,
        respawnMaxMinutes: t.respawnMaxMinutes,
        notes: t.notes,
        createdBy: adminUserId,
      })
    }
  }
}

export async function listTimerCategoriesWithTimers(now = Date.now()): Promise<TimerCategoryData[]> {
  const db = await getDb()

  // 1. Fetch categories
  const categories = await db
    .select({
      id: timerCategories.id,
      name: timerCategories.name,
      icon: timerCategories.icon,
      orderIndex: timerCategories.orderIndex,
    })
    .from(timerCategories)
    .orderBy(timerCategories.orderIndex, timerCategories.name)

  if (categories.length === 0) return []

  // 2. Fetch all timers
  const timersRows = await db
    .select({
      id: customTimers.id,
      categoryId: customTimers.categoryId,
      name: customTimers.name,
      channelsCount: customTimers.channelsCount,
      respawnMinMinutes: customTimers.respawnMinMinutes,
      respawnMaxMinutes: customTimers.respawnMaxMinutes,
      notes: customTimers.notes,
      createdById: customTimers.createdBy,
      createdByNick: users.gameNick,
      createdAt: customTimers.createdAt,
    })
    .from(customTimers)
    .innerJoin(users, eq(customTimers.createdBy, users.id))
    .orderBy(customTimers.name)

  if (timersRows.length === 0) {
    return categories.map((c) => ({
      ...c,
      timers: [],
    }))
  }

  const timerIds = timersRows.map((t) => t.id)

  // 3. Fetch latest kills for these timers
  const killsRows = await db
    .select({
      id: customTimerKills.id,
      timerId: customTimerKills.timerId,
      channel: customTimerKills.channel,
      killedAt: customTimerKills.killedAt,
      killedAtLabel: customTimerKills.killedAtLabel,
      reportedByNick: users.gameNick,
    })
    .from(customTimerKills)
    .innerJoin(users, eq(customTimerKills.reportedBy, users.id))
    .where(inArray(customTimerKills.timerId, timerIds))
    .orderBy(desc(customTimerKills.killedAt))

  // Map latest kill per timerId + channel
  const latestKillsMap = new Map<string, { id: string; killedAt: Date; killedAtLabel: string; reportedByNick: string }>()
  for (const kill of killsRows) {
    const key = `${kill.timerId}-${kill.channel}`
    if (!latestKillsMap.has(key)) {
      latestKillsMap.set(key, kill)
    }
  }

  // Build timer data with computed channel statuses
  const timersWithChannels: CustomTimerWithChannels[] = timersRows.map((t) => {
    const channels: BossChannelStatus[] = []
    for (let ch = 1; ch <= t.channelsCount; ch++) {
      const lastKill = latestKillsMap.get(`${t.id}-${ch}`) ?? null
      const status = computeChannelStatus(
        ch as RedChannel,
        lastKill,
        t.respawnMinMinutes,
        t.respawnMaxMinutes,
        now
      )
      channels.push(status)
    }

    return {
      id: t.id,
      categoryId: t.categoryId,
      name: t.name,
      channelsCount: t.channelsCount,
      respawnMinMinutes: t.respawnMinMinutes,
      respawnMaxMinutes: t.respawnMaxMinutes,
      notes: t.notes,
      createdById: t.createdById,
      createdByNick: t.createdByNick,
      createdAt: new Date(t.createdAt).toISOString(),
      channels,
    }
  })

  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    orderIndex: cat.orderIndex,
    timers: timersWithChannels.filter((t) => t.categoryId === cat.id),
  }))
}

export type RecentTimerKillItem = {
  id: string
  timerId: string
  timerName: string
  categoryName: string
  channel: number
  killedAt: string
  killedAtLabel: string
  reportedByNick: string
}

export async function listRecentTimerKills(limit = 40): Promise<RecentTimerKillItem[]> {
  const db = await getDb()
  const rows = await db
    .select({
      id: customTimerKills.id,
      timerId: customTimerKills.timerId,
      timerName: customTimers.name,
      categoryName: timerCategories.name,
      channel: customTimerKills.channel,
      killedAt: customTimerKills.killedAt,
      killedAtLabel: customTimerKills.killedAtLabel,
      reportedByNick: users.gameNick,
    })
    .from(customTimerKills)
    .innerJoin(customTimers, eq(customTimerKills.timerId, customTimers.id))
    .innerJoin(timerCategories, eq(customTimers.categoryId, timerCategories.id))
    .innerJoin(users, eq(customTimerKills.reportedBy, users.id))
    .orderBy(desc(customTimerKills.killedAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    timerId: r.timerId,
    timerName: r.timerName,
    categoryName: r.categoryName,
    channel: r.channel,
    killedAt: new Date(r.killedAt).toISOString(),
    killedAtLabel: r.killedAtLabel,
    reportedByNick: r.reportedByNick,
  }))
}
