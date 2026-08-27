import { type Playstyle, type PositionId, type SlotId } from "@/lib/constants"
import {
  formatWeekRangePl,
  weekEndForStart,
  weekStartForDate,
  weekStartInWarsaw,
} from "@/lib/dates"

export type FeeCharge = {
  userId: string
  gameNick: string
  playstyle: Playstyle | null
  date: string
  slot: SlotId
  position: PositionId
  feeKk: number
}

export type ConfirmedCredit = {
  userId: string
  amountKk: number
}

export type WeekEntry = {
  date: string
  slot: SlotId
  position: PositionId
  feeKk: number
}

export type WeekBalance = {
  weekStart: string
  weekEnd: string
  label: string
  closed: boolean
  entries: WeekEntry[]
  chargedKk: number
  remainingKk: number
}

export type UserFeeState = {
  userId: string
  gameNick: string
  playstyle: Playstyle | null
  overdueKk: number
  currentWeekRemainingKk: number
  overdueWeeks: WeekBalance[]
  currentWeek: WeekBalance | null
  settledWeeks: WeekBalance[]
}

export type PaymentOffer = {
  amountKk: number
  title: string
  label: string
  detail: string
}

export function paymentOffers(state: UserFeeState): PaymentOffer[] {
  if (state.overdueKk <= 0) return []
  const offers: PaymentOffer[] = []
  let running = 0
  const last = state.overdueWeeks.length - 1
  for (let i = 0; i < state.overdueWeeks.length; i++) {
    const week = state.overdueWeeks[i]
    running += week.remainingKk
    const isAll = i === last && state.overdueWeeks.length > 1
    const title = isAll ? "Całość" : week.label
    offers.push({
      amountKk: running,
      title,
      label: `${title} · ${running} kk`,
      detail: isAll
        ? `Wszystkie zaległe tygodnie (do ${week.label})`
        : i === 0
          ? "Najstarszy zaległy tydzień"
          : `Od najstarszego do ${week.label}`,
    })
  }
  return offers
}

export function isPaymentOfferAmount(state: UserFeeState, amountKk: number): boolean {
  if (!Number.isInteger(amountKk) || amountKk <= 0) return false
  return paymentOffers(state).some((offer) => offer.amountKk === amountKk)
}

export function buildFeeLedger(
  charges: FeeCharge[],
  credits: ConfirmedCredit[],
  now = new Date()
): Map<string, UserFeeState> {
  const currentWeekStart = weekStartInWarsaw(now)
  const byUser = new Map<
    string,
    {
      gameNick: string
      playstyle: Playstyle | null
      weeks: Map<string, WeekBalance>
    }
  >()

  for (const charge of charges) {
    let user = byUser.get(charge.userId)
    if (!user) {
      user = {
        gameNick: charge.gameNick,
        playstyle: charge.playstyle,
        weeks: new Map(),
      }
      byUser.set(charge.userId, user)
    }
    const weekStart = weekStartForDate(charge.date)
    let week = user.weeks.get(weekStart)
    if (!week) {
      const weekEnd = weekEndForStart(weekStart)
      week = {
        weekStart,
        weekEnd,
        label: formatWeekRangePl(weekStart),
        closed: weekStart < currentWeekStart,
        entries: [],
        chargedKk: 0,
        remainingKk: 0,
      }
      user.weeks.set(weekStart, week)
    }
    week.entries.push({
      date: charge.date,
      slot: charge.slot,
      position: charge.position,
      feeKk: charge.feeKk,
    })
    week.chargedKk += charge.feeKk
  }

  const creditByUser = new Map<string, number>()
  for (const credit of credits) {
    creditByUser.set(credit.userId, (creditByUser.get(credit.userId) ?? 0) + credit.amountKk)
  }

  const result = new Map<string, UserFeeState>()
  for (const [userId, user] of byUser) {
    let remainingCredit = creditByUser.get(userId) ?? 0
    const weeks = [...user.weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    for (const week of weeks) {
      week.entries.sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
      const applied = Math.min(week.chargedKk, remainingCredit)
      remainingCredit -= applied
      week.remainingKk = week.chargedKk - applied
    }

    const overdueWeeks = weeks.filter((week) => week.closed && week.remainingKk > 0)
    const settledWeeks = weeks.filter((week) => week.closed && week.remainingKk === 0)
    const currentWeek = weeks.find((week) => week.weekStart === currentWeekStart) ?? null

    result.set(userId, {
      userId,
      gameNick: user.gameNick,
      playstyle: user.playstyle,
      overdueKk: overdueWeeks.reduce((sum, week) => sum + week.remainingKk, 0),
      currentWeekRemainingKk: currentWeek?.remainingKk ?? 0,
      overdueWeeks,
      currentWeek,
      settledWeeks,
    })
  }

  return result
}
