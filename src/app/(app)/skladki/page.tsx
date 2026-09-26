import { FeesLeader } from "@/components/fees-leader"
import { FeesPlayer } from "@/components/fees-player"
import {
  emptyFeeState,
  getFeeLedger,
  listPaymentHistory,
  listPendingPayments,
} from "@/lib/queries"
import { requireUser } from "@/lib/session"
import { isDevLoginEnabled, type Playstyle } from "@/lib/constants"

export const dynamic = "force-dynamic"

export default async function FeesPage() {
  const user = await requireUser()
  const ledger = await getFeeLedger()
  const pending = await listPendingPayments()

  if (!user.isLeader) {
    const state =
      ledger.get(user.id) ??
      emptyFeeState(user.id, user.gameNick, (user.playstyle as Playstyle | null) ?? null)
    const myPending = pending.find((item) => item.userId === user.id) ?? null
    return (
      <div className="flex flex-col gap-6">
        <Header
          title="Składki"
          description="Rozliczenia składek za wyprawy. Wybierz widok poprzedniego tygodnia lub całości."
        />
        <FeesPlayer state={state} pending={myPending} />
      </div>
    )
  }

  const states = [...ledger.values()]
  const history = await listPaymentHistory()

  return (
    <div className="flex flex-col gap-6">
      <Header
        title="Składki"
        description="Zgłoszenia i zbiórka składek. Wybierz widok poprzedniego tygodnia lub całości."
      />
      <FeesLeader
        pending={pending}
        states={states}
        history={history}
        canSeed={isDevLoginEnabled()}
      />
    </div>
  )
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
