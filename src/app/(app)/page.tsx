import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DateNav } from "@/components/date-nav"
import { SignupGrid } from "@/components/signup-grid"
import { isIsoDate, formatDatePl, todayInWarsaw } from "@/lib/dates"
import { getDayGrid, listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const requested = params.d ?? ""
  const date = isIsoDate(requested) ? requested : todayInWarsaw()
  const grid = await getDayGrid(date)
  const mine = grid.findMine(user.id)
  const guildUsers = user.isLeader ? await listUsers() : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Siatka V3</h1>
        <p className="text-sm text-muted-foreground">
          Wpisz się w wolny slot
        </p>
      </div>

      {!user.playstyle ? (
        <Alert>
          <AlertTitle>Ustaw PVP albo PVM</AlertTitle>
          <AlertDescription>
            Zanim zapiszesz się na slot, wejdź w Konto i wybierz typ postaci (3 kk / 7 kk).
          </AlertDescription>
        </Alert>
      ) : null}

      <DateNav date={date} label={formatDatePl(date)} />
      <SignupGrid
        date={date}
        cells={grid.cells}
        currentUserId={user.id}
        isLeader={user.isLeader}
        mySignup={mine}
        users={guildUsers.map((item) => ({
          id: item.id,
          gameNick: item.gameNick,
          playstyle: item.playstyle,
        }))}
      />
    </div>
  )
}
