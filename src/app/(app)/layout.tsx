import type { ReactNode } from "react"
import { AppNav } from "@/components/app-nav"
import { countPendingPayments } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const runtime = "nodejs"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  const pendingPayments = user.isLeader ? await countPendingPayments() : 0

  return (
    <>
      <AppNav nick={user.gameNick} isLeader={user.isLeader} pendingPayments={pendingPayments} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </>
  )
}
