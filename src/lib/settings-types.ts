export const DEFAULT_FEE_SETTLEMENT_DAYS = 2
export const SETTING_KEY_FEE_SETTLEMENT_DAYS = "fee_settlement_days"

export const DEFAULT_SIGNUP_ADVANCE_DAYS = 2
export const SETTING_KEY_SIGNUP_ADVANCE_DAYS = "signup_advance_days"

export const DEFAULT_SIGNUP_OPEN_TIME = "09:00"
export const SETTING_KEY_SIGNUP_OPEN_TIME = "signup_open_time"

export type PenaltyLevelConfig = {
  durationDays: number
  advanceDays: number
}

export type PenaltyRulesConfig = {
  card1: PenaltyLevelConfig
  card2: PenaltyLevelConfig
  card3: PenaltyLevelConfig
}

export const DEFAULT_PENALTY_RULES: PenaltyRulesConfig = {
  card1: { durationDays: 3, advanceDays: 1 },
  card2: { durationDays: 7, advanceDays: 1 },
  card3: { durationDays: 14, advanceDays: 1 },
}

export const SETTING_KEY_PENALTY_RULES = "penalty_rules"

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
