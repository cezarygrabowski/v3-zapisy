import { AdminNav } from "@/components/admin-nav"
import { AdminBossTimers } from "@/components/admin-boss-timers"
import { AdminFeeSettings } from "@/components/admin-fee-settings"
import { AdminSignupPenaltySettings } from "@/components/admin-signup-penalty-settings"
import { requireLeader } from "@/lib/session"
import { getFeeSettlementDays, getPenaltyRules, getSignupAdvanceDays, getSignupOpenTime } from "@/lib/settings"
import {
  ensureDefaultTimerCategories,
  listTimerCategoriesWithTimers,
} from "@/lib/timers-queries"

export const dynamic = "force-dynamic"

export default async function AdminKonfiguracjaPage() {
  const leader = await requireLeader()
  await ensureDefaultTimerCategories(leader.id)

  const [settlementDays, timerCategories, signupAdvanceDays, signupOpenTime, penaltyRules] = await Promise.all([
    getFeeSettlementDays(),
    listTimerCategoriesWithTimers(),
    getSignupAdvanceDays(),
    getSignupOpenTime(),
    getPenaltyRules(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Admin — Konfiguracja</h1>
        <p className="text-sm text-muted-foreground">
          Ustawienia parametrów gildyjnych: wyprzedzenie zapisów na wydarzenia, stopnie i wymiary kar, okienka bossów oraz regulamin składek.
        </p>
      </div>

      <AdminNav />

      <AdminSignupPenaltySettings
        initialAdvanceDays={signupAdvanceDays}
        initialOpenTime={signupOpenTime}
        initialPenaltyRules={penaltyRules}
      />

      <AdminFeeSettings initialDays={settlementDays} />

      <AdminBossTimers categories={timerCategories} />
    </div>
  )
}
