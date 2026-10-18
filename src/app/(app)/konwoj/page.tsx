import { KonwojGroupsAdmin, KonwojView } from "@/components/konwoj-view"
import { addDays, formatWeekRangePl, isIsoDate, weekStartForDate, weekStartInWarsaw } from "@/lib/dates"
import { canManageKonwojGroup, getKonwojWeek, listKonwojGroups, listKonwojPrices } from "@/lib/konwoj"
import { listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function KonwojPage({
  searchParams,
}: {
  searchParams: Promise<{ tydzien?: string; druzyna?: string }>
}) {
  const user = await requireUser()
  const { tydzien, druzyna } = await searchParams
  const currentWeek = weekStartInWarsaw()
  const weekStart = tydzien && isIsoDate(tydzien) ? weekStartForDate(tydzien) : currentWeek

  const groups = await listKonwojGroups()
  // Groups are private: players see only their own, the admin sees all.
  const visible = user.isLeader ? groups : groups.filter((g) => g.members.some((m) => m.userId === user.id))
  const group =
    visible.find((g) => g.id === druzyna) ??
    visible.find((g) => g.members.some((m) => m.userId === user.id)) ??
    visible[0]

  const [week, prices, allUsers] = await Promise.all([
    group ? getKonwojWeek(group, weekStart) : null,
    group ? listKonwojPrices(group.id) : [],
    user.isLeader ? listUsers() : [],
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold">🐍 Konwój Kompanii</h1>
          <p className="text-sm text-muted-foreground">
            Każda drużyna rozlicza się osobno: czyste yang i itemy na shopie dzielone według liczby wejść w tygodniu.
          </p>
        </div>
        {user.isLeader ? (
          <KonwojGroupsAdmin groups={groups} users={allUsers.map((u) => ({ id: u.id, gameNick: u.gameNick }))} />
        ) : null}
      </div>

      {group && week ? (
        <KonwojView
          groups={visible.map((g) => ({ id: g.id, name: g.name }))}
          group={group}
          week={week}
          weekLabel={formatWeekRangePl(weekStart)}
          prevWeek={addDays(weekStart, -7)}
          nextWeek={addDays(weekStart, 7)}
          isCurrentWeek={weekStart === currentWeek}
          canManage={canManageKonwojGroup(user, group)}
          currentUserId={user.id}
          prices={prices}
        />
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {user.isLeader
            ? "Nie ma jeszcze żadnej drużyny. Utwórz pierwszą przyciskiem „Zarządzaj drużynami”."
            : "Nie należysz do żadnej drużyny Konwoju. Poproś admina o przypisanie."}
        </p>
      )}
    </div>
  )
}
