import type { ReactNode } from "react"
import { AppNav } from "@/components/app-nav"
import { AlertsProvider } from "@/components/alerts-provider"
import { listPersonalTimers } from "@/lib/personal-timers"
import { ImpersonationBanner } from "@/components/impersonation-banner"
import { VerificationPendingView } from "@/components/verification-pending-view"
import { countPendingPayments } from "@/lib/queries"
import { getImpersonationState, requireUser } from "@/lib/session"

export const runtime = "nodejs"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()

  if (!user.isLeader && !user.isVerified) {
    return (
      <main className="mx-auto flex w-full max-w-[1720px] flex-1 flex-col px-4 py-6">
        <VerificationPendingView gameNick={user.gameNick} discordName={user.discordName} />
      </main>
    )
  }

  const impState = await getImpersonationState()
  const pendingPayments = user.isLeader ? await countPendingPayments() : 0
  const timers = await listPersonalTimers(user.id)
  const initialNow = new Date().getTime()

  return (
    <AlertsProvider key={user.id} timers={timers} initialNow={initialNow}>
      {impState.isImpersonating && impState.realUser && impState.impersonatedUser ? (
        <ImpersonationBanner
          realNick={impState.realUser.gameNick}
          impersonatedNick={impState.impersonatedUser.gameNick}
          impersonatedPlaystyle={impState.impersonatedUser.playstyle}
        />
      ) : null}
      <AppNav nick={user.gameNick} isLeader={user.isLeader} pendingPayments={pendingPayments} />
      <main className="mx-auto flex w-full max-w-[1720px] flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </AlertsProvider>
  )
}
