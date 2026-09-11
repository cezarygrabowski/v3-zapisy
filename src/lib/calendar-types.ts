import { warsawWallToDate } from "@/lib/dates"
import type { ExpeditionHourBlock } from "@/lib/red-las"

export type GuildEventType = "v3" | "red_las" | "dungeon" | "other"

export type RecurrenceType = "none" | "daily" | "weekly" | "weekdays"

export const V3_EVENT_SPOTS = [
  { id: "R1", name: "R1", desc: "Od wejścia w górę", color: "#F4D03F" },
  { id: "R2", name: "R2", desc: "Lewo (z koronami)", color: "#C48A55" },
  { id: "R3", name: "R3", desc: "Góra-lewo", color: "#9BB6BA" },
  {
    id: "R2_R3_KORYTARZ",
    name: "R2 - R3 korytarz",
    desc: "Najsłabszy spot, nie bije kokonów (32–20)",
    color: "#06B6D4",
  },
  { id: "PRAWO", name: "Prawo", desc: "Góra-prawo", color: "#8B5A2B" },
  { id: "R1_KORYTARZ", name: "R1 korytarz", desc: "Środek-dół", color: "#9B6BDB" },
  { id: "PRAWO_KORYTARZ", name: "Prawo korytarz", desc: "Prawo-dół", color: "#F5C6CE" },
] as const

export const RED_LAS_EVENT_SPOTS = [
  { id: "boss", name: "Boss (Drzewo / 5 CH)", desc: "Główny boss z podziałem dropu", icon: "👑" },
  { id: "polka", name: "Półka", desc: "Spot exp / drop", icon: "🌲" },
  { id: "koniec_lasku", name: "Koniec lasku", desc: "Spot przed bossem", icon: "🌲" },
  { id: "zarowa", name: "Żarówa", desc: "Spot z szybkim respem mobów", icon: "💡" },
] as const

export function calculateDurationHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const startMins = (sh || 0) * 60 + (sm || 0)
  let endMins = (eh || 0) * 60 + (em || 0)
  if (endMins <= startMins) {
    endMins += 24 * 60
  }
  // Return duration rounded to nearest 0.5h (half hour), minimum 0.5h
  return Math.max(0.5, Math.round(((endMins - startMins) / 60) * 2) / 2)
}

export function computeEventEffectiveStatus(
  status: string,
  date: string,
  startTime: string,
  durationHours: number,
  now = new Date()
): "planned" | "active" | "finished" | "cancelled" {
  if (status === "cancelled") return "cancelled"

  const hms = startTime.length === 5 ? `${startTime}:00` : startTime
  const startDate = warsawWallToDate(date, hms)

  if (!startDate) {
    return (status as "planned" | "active" | "finished" | "cancelled") || "planned"
  }

  const startMs = startDate.getTime()
  const endMs = startMs + durationHours * 60 * 60 * 1000
  const nowMs = now.getTime()

  if (nowMs < startMs) {
    return "planned"
  } else if (nowMs < endMs) {
    return "active"
  } else {
    return "finished"
  }
}

export type EventColorId =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "brown"

export interface EventColorPreset {
  id: EventColorId
  label: string
  hex: string
  dotClass: string
  // Apple Calendar style: left stripe color, translucent background, refined text colors
  stripeClass: string
  cardBg: string
  cardBorder: string
  titleText: string
  timeText: string
  subText: string
  badgeClass: string
}

export const EVENT_COLORS: Record<EventColorId, EventColorPreset> = {
  red: {
    id: "red",
    label: "Czerwony",
    hex: "#FF3B30",
    dotClass: "bg-[#FF3B30]",
    stripeClass: "bg-[#FF3B30]",
    cardBg: "bg-[#FF3B30]/10 hover:bg-[#FF3B30]/15 dark:bg-[#FF3B30]/20 dark:hover:bg-[#FF3B30]/25",
    cardBorder: "border-[#FF3B30]/25 dark:border-[#FF3B30]/40",
    titleText: "text-[#D70015] dark:text-[#FF6961] font-semibold",
    timeText: "text-[#D70015]/80 dark:text-[#FF6961]/90",
    subText: "text-[#D70015]/70 dark:text-[#FF6961]/70",
    badgeClass: "bg-[#FF3B30] text-white",
  },
  orange: {
    id: "orange",
    label: "Pomarańczowy",
    hex: "#FF9500",
    dotClass: "bg-[#FF9500]",
    stripeClass: "bg-[#FF9500]",
    cardBg: "bg-[#FF9500]/10 hover:bg-[#FF9500]/15 dark:bg-[#FF9500]/20 dark:hover:bg-[#FF9500]/25",
    cardBorder: "border-[#FF9500]/25 dark:border-[#FF9500]/40",
    titleText: "text-[#C93400] dark:text-[#FFB340] font-semibold",
    timeText: "text-[#C93400]/80 dark:text-[#FFB340]/90",
    subText: "text-[#C93400]/70 dark:text-[#FFB340]/70",
    badgeClass: "bg-[#FF9500] text-white",
  },
  yellow: {
    id: "yellow",
    label: "Żółty",
    hex: "#FFCC00",
    dotClass: "bg-[#FFCC00]",
    stripeClass: "bg-[#FFCC00]",
    cardBg: "bg-[#FFCC00]/15 hover:bg-[#FFCC00]/20 dark:bg-[#FFCC00]/20 dark:hover:bg-[#FFCC00]/25",
    cardBorder: "border-[#FFCC00]/30 dark:border-[#FFCC00]/40",
    titleText: "text-[#9E6A00] dark:text-[#FFD60A] font-semibold",
    timeText: "text-[#9E6A00]/80 dark:text-[#FFD60A]/90",
    subText: "text-[#9E6A00]/70 dark:text-[#FFD60A]/70",
    badgeClass: "bg-[#FFCC00] text-zinc-950",
  },
  green: {
    id: "green",
    label: "Zielony",
    hex: "#34C759",
    dotClass: "bg-[#34C759]",
    stripeClass: "bg-[#34C759]",
    cardBg: "bg-[#34C759]/10 hover:bg-[#34C759]/15 dark:bg-[#34C759]/20 dark:hover:bg-[#34C759]/25",
    cardBorder: "border-[#34C759]/25 dark:border-[#34C759]/40",
    titleText: "text-[#1C7A34] dark:text-[#5CE685] font-semibold",
    timeText: "text-[#1C7A34]/80 dark:text-[#5CE685]/90",
    subText: "text-[#1C7A34]/70 dark:text-[#5CE685]/70",
    badgeClass: "bg-[#34C759] text-white",
  },
  blue: {
    id: "blue",
    label: "Niebieski",
    hex: "#007AFF",
    dotClass: "bg-[#007AFF]",
    stripeClass: "bg-[#007AFF]",
    cardBg: "bg-[#007AFF]/10 hover:bg-[#007AFF]/15 dark:bg-[#007AFF]/20 dark:hover:bg-[#007AFF]/25",
    cardBorder: "border-[#007AFF]/25 dark:border-[#007AFF]/40",
    titleText: "text-[#0051A8] dark:text-[#64D2FF] font-semibold",
    timeText: "text-[#0051A8]/80 dark:text-[#64D2FF]/90",
    subText: "text-[#0051A8]/70 dark:text-[#64D2FF]/70",
    badgeClass: "bg-[#007AFF] text-white",
  },
  purple: {
    id: "purple",
    label: "Fioletowy",
    hex: "#AF52DE",
    dotClass: "bg-[#AF52DE]",
    stripeClass: "bg-[#AF52DE]",
    cardBg: "bg-[#AF52DE]/10 hover:bg-[#AF52DE]/15 dark:bg-[#AF52DE]/20 dark:hover:bg-[#AF52DE]/25",
    cardBorder: "border-[#AF52DE]/25 dark:border-[#AF52DE]/40",
    titleText: "text-[#7B1FA2] dark:text-[#DA8FFF] font-semibold",
    timeText: "text-[#7B1FA2]/80 dark:text-[#DA8FFF]/90",
    subText: "text-[#7B1FA2]/70 dark:text-[#DA8FFF]/70",
    badgeClass: "bg-[#AF52DE] text-white",
  },
  brown: {
    id: "brown",
    label: "Brązowy",
    hex: "#A2845E",
    dotClass: "bg-[#A2845E]",
    stripeClass: "bg-[#A2845E]",
    cardBg: "bg-[#A2845E]/12 hover:bg-[#A2845E]/18 dark:bg-[#A2845E]/20 dark:hover:bg-[#A2845E]/25",
    cardBorder: "border-[#A2845E]/25 dark:border-[#A2845E]/40",
    titleText: "text-[#6A4E2A] dark:text-[#D1B894] font-semibold",
    timeText: "text-[#6A4E2A]/80 dark:text-[#D1B894]/90",
    subText: "text-[#6A4E2A]/70 dark:text-[#D1B894]/70",
    badgeClass: "bg-[#A2845E] text-white",
  },
}

export function getEventColorPreset(colorId?: string | null): EventColorPreset {
  if (colorId && colorId in EVENT_COLORS) {
    return EVENT_COLORS[colorId as EventColorId]
  }
  // Backwards compatibility aliases
  if (colorId === "emerald") return EVENT_COLORS.green
  if (colorId === "rose") return EVENT_COLORS.red
  if (colorId === "amber") return EVENT_COLORS.yellow
  if (colorId === "indigo" || colorId === "cyan") return EVENT_COLORS.blue

  return EVENT_COLORS.blue
}

export const EVENT_TYPE_METADATA: Record<
  GuildEventType,
  { label: string; icon: string; defaultColor: EventColorId; mode: "v3_spots" | "red_las_spots" | "party" }
> = {
  v3: {
    label: "V3",
    icon: "🕷️",
    defaultColor: "blue",
    mode: "v3_spots",
  },
  red_las: {
    label: "Red Las",
    icon: "🌲",
    defaultColor: "green",
    mode: "red_las_spots",
  },
  dungeon: {
    label: "Dungeon",
    icon: "🐉",
    defaultColor: "purple",
    mode: "party",
  },
  other: {
    label: "Inne wydarzenie",
    icon: "📅",
    defaultColor: "orange",
    mode: "party",
  },
}

export type GuildEventListItem = {
  id: string
  title: string
  type: GuildEventType
  color: string
  date: string
  startTime: string
  endTime: string | null
  durationHours: number
  signupMode: string
  recurrence: string
  maxParticipants: number | null
  description: string | null
  status: "planned" | "active" | "finished" | "cancelled"
  createdById: string
  createdByNick: string
  createdAt: string
  totalSignups: number
  uniqueUsersCount: number
  mySignup?: {
    signupId: string
    spot: string | null
    role: string | null
  } | null
}

export type EventSignupEntry = {
  signupId: string
  userId: string
  gameNick: string
  characterId?: string | null
  characterName?: string | null
  userNick?: string | null
  hourIndex: number
  spot: string | null
  role: string | null
  attended: boolean
  createdAt: string
}

export type EventDetails = {
  id: string
  title: string
  type: GuildEventType
  color: string
  date: string
  startTime: string
  endTime: string | null
  durationHours: number
  signupMode: string
  recurrence: string
  maxParticipants: number | null
  description: string | null
  status: "planned" | "active" | "finished" | "cancelled"
  createdById: string
  createdByNick: string
  createdAt: string
  hourSlots: {
    block: ExpeditionHourBlock
    signups: EventSignupEntry[]
  }[]
  signups: EventSignupEntry[]
  allParticipants: { userId: string; gameNick: string; count: number; attendedCount: number }[]
  currentUserFeeLock?: UserFeeLockInfo
  currentUserPenalty?: UserPenaltyLockInfo | null
  currentUserCharacters?: {
    id: string
    name: string
    playstyle: "pvp" | "pvm"
    isMain: boolean
  }[]
  signupAdvanceDays?: number
  signupOpenTime?: string
  restrictedAccess?: boolean
  auditLogs?: GuildEventAuditLogEntry[]
}

export type GuildEventAuditLogEntry = {
  id: string
  eventId: string
  action:
    | "signup"
    | "withdraw"
    | "admin_withdraw"
    | "admin_assign"
    | "reschedule"
    | "edit"
    | "spot_transfer"
    | "yellow_card"
  actorId: string
  actorNick: string
  targetUserId: string | null
  targetUserNick: string | null
  spot: string | null
  role: string | null
  reason: string | null
  details: string | null
  createdAt: string
}

export type UserPenaltyLockInfo = {
  hasPenalty: boolean
  cardLevel: number
  durationDays: number
  allowedAdvanceDays: number
  expiresAt: string
  expiresAtPl: string
  reason: string
}

export type UserFeeLockInfo = {
  isLocked: boolean
  overdueKk: number
  settlementDays: number
  deadlineDate: string
  deadlineDatePl: string
  hasPendingPayment: boolean
  pendingAmountKk: number
  reason?: string
}

