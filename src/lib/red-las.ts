export const RED_CHANNELS = [1, 2, 3, 4, 5] as const
export type RedChannel = (typeof RED_CHANNELS)[number]

export const DEFAULT_RESPAWN_MIN = 48
export const DEFAULT_RESPAWN_MAX = 52

export const RED_LAS_SPOTS = [
  {
    id: "boss",
    name: "Boss (Drzewo / 5 CH)",
    badge: "Boss 5CH",
    isBoss: true,
    desc: "Wyprawa na Władcę Drzew na końcu lasu (okno 48–52 min) ze wspólnym dropem i rozliczeniem",
    icon: "👑",
  },
  {
    id: "polka",
    name: "Półka",
    badge: "Spot Exp/Drop",
    isBoss: false,
    desc: "Górna i dolna półka do expienia i dropienia",
    icon: "🌲",
  },
  {
    id: "koniec_lasku",
    name: "Koniec lasku",
    badge: "Spot Exp/Drop",
    isBoss: false,
    desc: "Miejscówka przed samym bossem pod koniec lasu",
    icon: "🌲",
  },
  {
    id: "zarowa",
    name: "Żarówa",
    badge: "Spot Exp/Drop",
    isBoss: false,
    desc: "Spot z dużym i szybkim respem mobów (Żarówa)",
    icon: "💡",
  },
] as const

export type RedSpotId = (typeof RED_LAS_SPOTS)[number]["id"]

export function getSpotById(spotId: string) {
  return RED_LAS_SPOTS.find((s) => s.id === spotId) ?? RED_LAS_SPOTS[0]
}

export type ExpeditionHourBlock = {
  index: number
  label: string
  startHour: string
  endHour: string
  startMinutes: number
  endMinutes: number
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${pad(m)}:${pad(s)}`
}

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${pad(h)}:${pad(m)}`
}

export function getExpeditionHourBlocks(
  startTime: string,
  durationHours: number
): ExpeditionHourBlock[] {
  const startMins = parseTimeToMinutes(startTime)
  const blocks: ExpeditionHourBlock[] = []

  for (let i = 0; i < durationHours; i++) {
    const blockStart = startMins + i * 60
    const blockEnd = blockStart + 60
    const startStr = formatMinutesToTime(blockStart)
    const endStr = formatMinutesToTime(blockEnd)
    blocks.push({
      index: i,
      label: `${startStr}–${endStr}`,
      startHour: startStr,
      endHour: endStr,
      startMinutes: blockStart,
      endMinutes: blockEnd,
    })
  }

  return blocks
}

export type BossChannelStatus = {
  channel: RedChannel
  lastKill: {
    id: string
    killedAt: string
    killedAtLabel: string
    reportedByNick: string
  } | null
  respawnMinMinutes: number
  respawnMaxMinutes: number
  windowStartAt: string | null
  windowEndAt: string | null
  status: "unknown" | "counting" | "window" | "overdue"
  remainingToWindowSeconds: number
  remainingInWindowSeconds: number
  overdueSeconds: number
  formattedStatusText: string
}

export function computeChannelStatus(
  channel: RedChannel,
  lastKill: {
    id: string
    killedAt: Date | string
    killedAtLabel: string
    reportedByNick: string
  } | null,
  respawnMinMinutes = DEFAULT_RESPAWN_MIN,
  respawnMaxMinutes = DEFAULT_RESPAWN_MAX,
  now = Date.now()
): BossChannelStatus {
  if (!lastKill) {
    return {
      channel,
      lastKill: null,
      respawnMinMinutes,
      respawnMaxMinutes,
      windowStartAt: null,
      windowEndAt: null,
      status: "unknown",
      remainingToWindowSeconds: 0,
      remainingInWindowSeconds: 0,
      overdueSeconds: 0,
      formattedStatusText: "Brak danych o zbiciu",
    }
  }

  const killedTime = new Date(lastKill.killedAt).getTime()
  const windowStartMs = killedTime + respawnMinMinutes * 60 * 1000
  const windowEndMs = killedTime + respawnMaxMinutes * 60 * 1000

  let status: "counting" | "window" | "overdue" = "counting"
  let remainingToWindowSeconds = 0
  let remainingInWindowSeconds = 0
  let overdueSeconds = 0
  let formattedStatusText = ""

  if (now < windowStartMs) {
    status = "counting"
    remainingToWindowSeconds = Math.max(0, Math.round((windowStartMs - now) / 1000))
    formattedStatusText = `Do okna: ${formatDuration(remainingToWindowSeconds)}`
  } else if (now <= windowEndMs) {
    status = "window"
    remainingInWindowSeconds = Math.max(0, Math.round((windowEndMs - now) / 1000))
    formattedStatusText = `OKNO RESPU (48–52m)`
  } else {
    status = "overdue"
    overdueSeconds = Math.max(0, Math.round((now - windowEndMs) / 1000))
    formattedStatusText = `Po oknie (+${formatDuration(overdueSeconds)})`
  }

  return {
    channel,
    lastKill: {
      id: lastKill.id,
      killedAt: new Date(lastKill.killedAt).toISOString(),
      killedAtLabel: lastKill.killedAtLabel,
      reportedByNick: lastKill.reportedByNick,
    },
    respawnMinMinutes,
    respawnMaxMinutes,
    windowStartAt: new Date(windowStartMs).toISOString(),
    windowEndAt: new Date(windowEndMs).toISOString(),
    status,
    remainingToWindowSeconds,
    remainingInWindowSeconds,
    overdueSeconds,
    formattedStatusText,
  }
}

export type WeeklySettlementPlayer = {
  userId: string
  gameNick: string
  attendedHours: number
  percentage: number
  payoutWon: number
  payoutKk: number
  isPaid: boolean
  paidAt: string | null
  paidByNick: string | null
}

export type WeeklySettlementSummary = {
  weekStart: string
  weekEnd: string
  weekLabel: string
  totalPotWon: number
  totalPotKk: number
  totalAttendedHours: number
  rateWonPerHour: number
  rateKkPerHour: number
  players: WeeklySettlementPlayer[]
  itemsListedCount: number
  itemsSoldCount: number
}

export function calculateWeeklySettlement(
  weekStart: string,
  weekEnd: string,
  weekLabel: string,
  userHours: { userId: string; gameNick: string; attendedHours: number }[],
  totalSoldWon: number,
  totalSoldKk: number,
  payouts: Map<string, { isPaid: boolean; paidAt: string | null; paidByNick: string | null }>,
  itemsListedCount = 0,
  itemsSoldCount = 0
): WeeklySettlementSummary {
  const activePlayers = userHours.filter((u) => u.attendedHours > 0)
  const totalAttendedHours = activePlayers.reduce((sum, u) => sum + u.attendedHours, 0)

  const rateWonPerHour = totalAttendedHours > 0 ? Math.floor(totalSoldWon / totalAttendedHours) : 0
  const rateKkPerHour = totalAttendedHours > 0 ? Math.floor(totalSoldKk / totalAttendedHours) : 0

  const players: WeeklySettlementPlayer[] = activePlayers.map((player) => {
    const percentage = totalAttendedHours > 0 ? (player.attendedHours / totalAttendedHours) * 100 : 0
    const payoutWon = player.attendedHours * rateWonPerHour
    const payoutKk = player.attendedHours * rateKkPerHour
    const payoutInfo = payouts.get(player.userId)

    return {
      userId: player.userId,
      gameNick: player.gameNick,
      attendedHours: player.attendedHours,
      percentage: Math.round(percentage * 10) / 10,
      payoutWon,
      payoutKk,
      isPaid: payoutInfo?.isPaid ?? false,
      paidAt: payoutInfo?.paidAt ?? null,
      paidByNick: payoutInfo?.paidByNick ?? null,
    }
  })

  players.sort((a, b) => b.attendedHours - a.attendedHours || a.gameNick.localeCompare(b.gameNick, "pl"))

  return {
    weekStart,
    weekEnd,
    weekLabel,
    totalPotWon: totalSoldWon,
    totalPotKk: totalSoldKk,
    totalAttendedHours,
    rateWonPerHour,
    rateKkPerHour,
    players,
    itemsListedCount,
    itemsSoldCount,
  }
}
