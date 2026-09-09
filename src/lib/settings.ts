import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildSettings } from "@/lib/db/schema"
import { addDays, formatDatePl, todayInWarsaw, weekStartInWarsaw } from "@/lib/dates"
import { getFeeLedger, listPendingPayments } from "@/lib/queries"

export const DEFAULT_FEE_SETTLEMENT_DAYS = 2
export const SETTING_KEY_FEE_SETTLEMENT_DAYS = "fee_settlement_days"

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

export type UserFeeLockStatus = {
  isLocked: boolean
  overdueKk: number
  settlementDays: number
  deadlineDate: string
  deadlineDatePl: string
  daysElapsed: number
  hasPendingPayment: boolean
  pendingAmountKk: number
  reason?: string
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
