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
          description="Zaległe z poprzednich tygodni. Bieżący tydzień nalicza się do niedzieli."
        />
        <FeesPlayer state={state} pending={myPending} />
      </div>
    )
  }

  const states = [...ledger.values()]
  const owing = states
    .filter((row) => row.overdueKk > 0)
    .sort((a, b) => b.overdueKk - a.overdueKk || a.gameNick.localeCompare(b.gameNick, "pl"))
  const clear = states.filter((row) => row.overdueKk === 0)
  const history = await listPaymentHistory()

  return (
    <div className="flex flex-col gap-6">
      <Header
        title="Składki"
        description="Zgłoszenia na górze, zbiórka poniżej. Propozycje spłaty schodzą od najstarszego tygodnia."
      />
      <FeesLeader
        pending={pending}
        owing={owing}
        clear={clear}
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
