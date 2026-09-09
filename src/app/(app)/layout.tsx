import type { ReactNode } from "react"
import { AppNav } from "@/components/app-nav"
import { ImpersonationBanner } from "@/components/impersonation-banner"
import { countPendingPayments } from "@/lib/queries"
import { getImpersonationState, requireUser } from "@/lib/session"

export const runtime = "nodejs"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  const impState = await getImpersonationState()
  const pendingPayments = user.isLeader ? await countPendingPayments() : 0

  return (
    <>
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
    </>
  )
}
