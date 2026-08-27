import { LiveRefresh } from "@/components/live-refresh"
import { RunDashboard } from "@/components/run-dashboard"
import { V3Map } from "@/components/v3-map"
import { Badge } from "@/components/ui/badge"
import { MAP_ZONES, positionLabel, slotLabel } from "@/lib/constants"
import { ZONE_COLORS } from "@/lib/v3-map"
import { relevantSlot, todayInWarsaw } from "@/lib/dates"
import { getSlotRoster, listKillStats, listKillsForDate, listRunSyncs, listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

const STATUS_LABEL = {
  trwa: "Trwa",
  nastepny: "Następny slot",
  skonczony: "Koniec na dziś",
}

export default async function RunPage() {
  const user = await requireUser()
  const date = todayInWarsaw()
  const slot = relevantSlot()
  const roster = await getSlotRoster(date, slot.id)
  const kills = await listKillsForDate(date)
  const syncs = await listRunSyncs()
  const killStats = await listKillStats(null)
  const occupied = roster.filter((member) => member.userId)
  const people =
    occupied.length > 0
      ? occupied.map((member) => ({
          id: member.userId as string,
          gameNick: member.gameNick as string,
          positionLabel: positionLabel(member.position),
        }))
      : (await listUsers()).map((item) => ({
          id: item.id,
          gameNick: item.gameNick,
        }))

  const byPosition = new Map(roster.map((member) => [member.position, member]))

  return (
    <div className="flex flex-col gap-8">
      <LiveRefresh seconds={4} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold">Run</h1>
          <Badge variant="secondary">{STATUS_LABEL[slot.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {slotLabel(slot.id)}. Strona odświeża się sama.
        </p>
      </div>

      <RunDashboard
        currentUserId={user.id}
        isLeader={user.isLeader}
        people={people}
        kills={kills}
        syncs={syncs}
        queenCounts={killStats.map((row) => ({
          userId: row.userId,
          queens: row.queens,
        }))}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Kto jest w V3</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MAP_ZONES.map((zone) => {
            const member = byPosition.get(zone.position)
            return (
              <li
                key={zone.position}
                className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10"
              >
                <span
                  className="size-4 shrink-0 rounded-sm ring-1 ring-foreground/20"
                  style={{ backgroundColor: ZONE_COLORS[zone.position] }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{positionLabel(zone.position)}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {member?.gameNick ?? "wolne"}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Mapa kokonów</h2>
        <V3Map
          roster={roster.map((member) => ({
            position: member.position,
            gameNick: member.gameNick,
          }))}
        />
      </section>
    </div>
  )
}
