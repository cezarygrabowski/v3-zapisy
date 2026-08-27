import Link from "next/link"
import { KillStatsTable, StatsTable } from "@/components/stats-table"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { monthStartInWarsaw, weekStartInWarsaw } from "@/lib/dates"
import { listKillStats, listStats } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ zakres?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const range = params.zakres === "tydzien" || params.zakres === "wszystko" ? params.zakres : "miesiac"
  const fromDate =
    range === "tydzien" ? weekStartInWarsaw() : range === "miesiac" ? monthStartInWarsaw() : null
  const rows = await listStats(fromDate)
  const killRows = await listKillStats(fromDate)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Statystyki</h1>
        <p className="text-sm text-muted-foreground">
          Ile razy kto był na V3 i na której pozycji.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/statystyki?zakres=tydzien"
          className={buttonVariants({ size: "sm", variant: range === "tydzien" ? "secondary" : "outline" })}
        >
          Tydzień
        </Link>
        <Link
          href="/statystyki"
          className={buttonVariants({ size: "sm", variant: range === "miesiac" ? "secondary" : "outline" })}
        >
          Miesiąc
        </Link>
        <Link
          href="/statystyki?zakres=wszystko"
          className={buttonVariants({ size: "sm", variant: range === "wszystko" ? "secondary" : "outline" })}
        >
          Wszystko
        </Link>
      </div>

      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Jeszcze nikt się nie zapisał</EmptyTitle>
            <EmptyDescription>Statystyki pojawią się po pierwszych wejściach.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <StatsTable rows={rows} isLeader={user.isLeader} />
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">Królówki i baronki</h2>
        <p className="text-sm text-muted-foreground">
          Królówka liczy się osobie, która kliknęła. Baronka — wszystkim zaznaczonym plus zgłaszającemu.
        </p>
      </div>
      {killRows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Brak zbić w tym zakresie</EmptyTitle>
            <EmptyDescription>Log powstaje na stronie Run, jednym kliknięciem.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <KillStatsTable rows={killRows} />
      )}
    </div>
  )
}
