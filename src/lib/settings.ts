import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildSettings } from "@/lib/db/schema"
import { addDays, formatDatePl, todayInWarsaw, weekStartInWarsaw } from "@/lib/dates"
import { getFeeLedger, listPendingPayments } from "@/lib/queries"

export * from "@/lib/settings-types"
import {
  DEFAULT_FEE_SETTLEMENT_DAYS,
  DEFAULT_PENALTY_RULES,
  DEFAULT_SIGNUP_ADVANCE_DAYS,
  DEFAULT_SIGNUP_OPEN_TIME,
  SETTING_KEY_FEE_SETTLEMENT_DAYS,
  SETTING_KEY_PENALTY_RULES,
  SETTING_KEY_SIGNUP_ADVANCE_DAYS,
  SETTING_KEY_SIGNUP_OPEN_TIME,
  type PenaltyRulesConfig,
  type UserFeeLockStatus,
} from "@/lib/settings-types"

export async function getFeeSettlementDays(): Promise<number> {
  try {
    const db = await getDb()
    const [row] = await db
      .select({ value: guildSettings.value })
      .from(guildSettings)
      .where(eq(guildSettings.key, SETTING_KEY_FEE_SETTLEMENT_DAYS))

    if (!row?.value) return DEFAULT_FEE_SETTLEMENT_DAYS
    const parsed = parseInt(row.value, 10)
    if (Number.isNaN(parsed) || parsed < 0) return DEFAULT_FEE_SETTLEMENT_DAYS
    return Math.min(14, parsed)
  } catch (err) {
    console.error("Failed to query fee settlement days, using default:", err)
    return DEFAULT_FEE_SETTLEMENT_DAYS
  }
}

export async function getSignupAdvanceDays(): Promise<number> {
  try {
    const db = await getDb()
    const [row] = await db
      .select({ value: guildSettings.value })
      .from(guildSettings)
      .where(eq(guildSettings.key, SETTING_KEY_SIGNUP_ADVANCE_DAYS))

    if (!row?.value) return DEFAULT_SIGNUP_ADVANCE_DAYS
    const parsed = parseInt(row.value, 10)
    if (Number.isNaN(parsed) || parsed < 0) return DEFAULT_SIGNUP_ADVANCE_DAYS
    return Math.min(30, Math.max(0, parsed))
  } catch (err) {
    console.error("Failed to query signup advance days, using default:", err)
    return DEFAULT_SIGNUP_ADVANCE_DAYS
  }
}

export async function getSignupOpenTime(): Promise<string> {
  try {
    const db = await getDb()
    const [row] = await db
      .select({ value: guildSettings.value })
      .from(guildSettings)
      .where(eq(guildSettings.key, SETTING_KEY_SIGNUP_OPEN_TIME))

    if (!row?.value) return DEFAULT_SIGNUP_OPEN_TIME
    const val = row.value.trim()
    if (!/^\d{2}:\d{2}$/.test(val)) return DEFAULT_SIGNUP_OPEN_TIME
    const [h, m] = val.split(":").map(Number)
    if (h < 0 || h > 23 || m < 0 || m > 59) return DEFAULT_SIGNUP_OPEN_TIME
    return val
  } catch (err) {
    console.error("Failed to query signup open time, using default:", err)
    return DEFAULT_SIGNUP_OPEN_TIME
  }
}

export async function getPenaltyRules(): Promise<PenaltyRulesConfig> {
  try {
    const db = await getDb()
    const [row] = await db
      .select({ value: guildSettings.value })
      .from(guildSettings)
      .where(eq(guildSettings.key, SETTING_KEY_PENALTY_RULES))

    if (!row?.value) return DEFAULT_PENALTY_RULES
    const parsed = JSON.parse(row.value) as Partial<PenaltyRulesConfig>
    return {
      card1: {
        durationDays: Math.max(1, Number(parsed.card1?.durationDays) || DEFAULT_PENALTY_RULES.card1.durationDays),
        advanceDays: Math.max(0, Number(parsed.card1?.advanceDays) ?? DEFAULT_PENALTY_RULES.card1.advanceDays),
      },
      card2: {
        durationDays: Math.max(1, Number(parsed.card2?.durationDays) || DEFAULT_PENALTY_RULES.card2.durationDays),
        advanceDays: Math.max(0, Number(parsed.card2?.advanceDays) ?? DEFAULT_PENALTY_RULES.card2.advanceDays),
      },
      card3: {
        durationDays: Math.max(1, Number(parsed.card3?.durationDays) || DEFAULT_PENALTY_RULES.card3.durationDays),
        advanceDays: Math.max(0, Number(parsed.card3?.advanceDays) ?? DEFAULT_PENALTY_RULES.card3.advanceDays),
      },
    }
  } catch (err) {
    console.error("Failed to query penalty rules, using default:", err)
    return DEFAULT_PENALTY_RULES
  }
}

export async function checkUserFeeLock(
  userId: string,
  now = new Date()
): Promise<UserFeeLockStatus> {
  const settlementDays = await getFeeSettlementDays()
  const today = todayInWarsaw(now)
  const currentWeekStart = weekStartInWarsaw(now)
  const previousWeekStart = addDays(currentWeekStart, -7)

  // Compute days elapsed in current week since Monday (Monday = 0, Tuesday = 1, Wednesday = 2, ...)
  const [ty, tm, td] = today.split("-").map(Number)
  const [wy, wm, wd] = currentWeekStart.split("-").map(Number)
  const daysElapsed = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(wy, wm - 1, wd)) / 86400000
  )

  const deadlineDate = addDays(currentWeekStart, settlementDays)
  const deadlineDatePl = formatDatePl(deadlineDate)

  const [ledger, pendingList] = await Promise.all([
    getFeeLedger(),
    listPendingPayments(),
  ])

  const userState = ledger.get(userId)
  const userPending = pendingList.find((p) => p.userId === userId)
  const hasPendingPayment = Boolean(userPending)
  const pendingAmountKk = userPending?.amountKk ?? 0

  if (!userState || userState.overdueWeeks.length === 0) {
    return {
      isLocked: false,
      overdueKk: 0,
      settlementDays,
      deadlineDate,
      deadlineDatePl,
      daysElapsed,
      hasPendingPayment,
      pendingAmountKk,
    }
  }

  // Check 1: Did the user fail to settle weeks strictly older than previous week?
  const olderUnpaidWeeks = userState.overdueWeeks.filter(
    (w) => w.weekStart < previousWeekStart
  )
  if (olderUnpaidWeeks.length > 0) {
    const olderTotal = olderUnpaidWeeks.reduce((sum, w) => sum + w.remainingKk, 0)
    const reason = hasPendingPayment
      ? `Masz nieopłacone zaległe składki z wcześniejszych tygodni (${olderTotal} kk). Twoja zgłoszona wpłata (${pendingAmountKk} kk) oczekuje na potwierdzenie przez lidera.`
      : `Masz nieopłacone zaległe składki z wcześniejszych tygodni (${olderTotal} kk). Ureguluj je w zakładce Składki.`
    return {
      isLocked: true,
      overdueKk: userState.overdueKk,
      settlementDays,
      deadlineDate,
      deadlineDatePl,
      daysElapsed,
      hasPendingPayment,
      pendingAmountKk,
      reason,
    }
  }

  // Check 2: Unpaid fee for the previous week
  const prevWeek = userState.overdueWeeks.find((w) => w.weekStart === previousWeekStart)
  if (prevWeek && prevWeek.remainingKk > 0) {
    // Has the grace period expired?
    if (daysElapsed >= settlementDays) {
      const reason = hasPendingPayment
        ? `Masz nieuregulowaną składkę za poprzedni tydzień (${prevWeek.remainingKk} kk). Minął termin ${settlementDays} dni na jej opłacenie. Twoja wpłata (${pendingAmountKk} kk) czeka na potwierdzenie przez lidera.`
        : `Masz nieuregulowaną składkę za poprzedni tydzień (${prevWeek.remainingKk} kk). Minął termin ${settlementDays} dni na jej opłacenie (termin minął: ${deadlineDatePl}). Ureguluj składkę w zakładce Składki.`

      return {
        isLocked: true,
        overdueKk: userState.overdueKk,
        settlementDays,
        deadlineDate,
        deadlineDatePl,
        daysElapsed,
        hasPendingPayment,
        pendingAmountKk,
        reason,
      }
    }
  }

  return {
    isLocked: false,
    overdueKk: userState.overdueKk,
    settlementDays,
    deadlineDate,
    deadlineDatePl,
    daysElapsed,
    hasPendingPayment,
    pendingAmountKk,
  }
}
