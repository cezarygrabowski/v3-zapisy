import { type Playstyle, type PositionId, type SlotId } from "@/lib/constants"
import {
  addDays,
  formatWeekRangePl,
  weekEndForStart,
  weekStartForDate,
  weekStartInWarsaw,
} from "@/lib/dates"

export type FeeCharge = {
  userId: string
  gameNick: string
  playstyle: Playstyle | null
  userPlaystyle?: Playstyle | null
  date: string
  slot: SlotId | string
  position: PositionId | string
  feeKk: number
  feeWaived?: boolean
  feeWaivedReason?: string | null
}

export type ConfirmedCredit = {
  userId: string
  amountKk: number
}

export type WeekEntry = {
  date: string
  slot: SlotId | string
  position: PositionId | string
  feeKk: number
  feeWaived?: boolean
  feeWaivedReason?: string | null
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
  toDateKk: number
  currentWeekRemainingKk: number
  overdueWeeks: WeekBalance[]
  toDateWeeks: WeekBalance[]
  currentWeek: WeekBalance | null
  settledWeeks: WeekBalance[]
  previousWeek: WeekBalance
}

export type PaymentOffer = {
  amountKk: number
  title: string
  label: string
  playerLabel: string
  leaderLabel: string
  detail: string
}

export function paymentOffers(state: UserFeeState): PaymentOffer[] {
  if (state.toDateKk <= 0) return []
  const offers: PaymentOffer[] = []
  let running = 0
  const last = state.toDateWeeks.length - 1
  const isSingle = state.toDateWeeks.length === 1

  for (let i = 0; i < state.toDateWeeks.length; i++) {
    const week = state.toDateWeeks[i]
    running += week.remainingKk
    const isAll = i === last && state.toDateWeeks.length > 1
    const weekTitle = week.closed ? week.label : `${week.label} (ten tydzień)`
    const title = isSingle ? "Zapłaciłem" : isAll ? "Zapłaciłem całość" : weekTitle
    const playerLabel = isSingle
      ? `Zapłaciłem · ${running} kk`
      : isAll
        ? `Zapłaciłem całość · ${running} kk`
        : `Zapłaciłem: ${weekTitle} · ${running} kk`
    const leaderLabel = isSingle
      ? `Zapłacił · ${running} kk`
      : isAll
        ? `Zapłacił całość · ${running} kk`
        : `Zapłacił: ${weekTitle} · ${running} kk`

    offers.push({
      amountKk: running,
      title,
      label: playerLabel,
      playerLabel,
      leaderLabel,
      detail: isAll || isSingle
        ? `Wszystkie składki do tej pory (${running} kk)`
        : i === 0
          ? `Najstarszy tydzień (${weekTitle})`
          : `Od najstarszego do ${weekTitle}`,
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
        playstyle: charge.userPlaystyle ?? charge.playstyle,
        weeks: new Map(),
      }
      byUser.set(charge.userId, user)
    } else if (charge.userPlaystyle) {
      user.playstyle = charge.userPlaystyle
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
      feeWaived: charge.feeWaived,
      feeWaivedReason: charge.feeWaivedReason,
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
    const toDateWeeks = weeks.filter((week) => week.remainingKk > 0)
    const settledWeeks = weeks.filter((week) => week.closed && week.remainingKk === 0)
    const currentWeek = weeks.find((week) => week.weekStart === currentWeekStart) ?? null
    const previousWeekStart = addDays(currentWeekStart, -7)
    const previousWeek = weeks.find((week) => week.weekStart === previousWeekStart) ?? {
      weekStart: previousWeekStart,
      weekEnd: weekEndForStart(previousWeekStart),
      label: formatWeekRangePl(previousWeekStart),
      closed: true,
      entries: [],
      chargedKk: 0,
      remainingKk: 0,
    }

    result.set(userId, {
      userId,
      gameNick: user.gameNick,
      playstyle: user.playstyle,
      overdueKk: overdueWeeks.reduce((sum, week) => sum + week.remainingKk, 0),
      toDateKk: toDateWeeks.reduce((sum, week) => sum + week.remainingKk, 0),
      currentWeekRemainingKk: currentWeek?.remainingKk ?? 0,
      overdueWeeks,
      toDateWeeks,
      currentWeek,
      settledWeeks,
      previousWeek,
    })
  }

  return result
}
