import { GuildCalendar } from "@/components/calendar/guild-calendar"
import { listGuildEvents } from "@/lib/calendar-queries"
import { addDays, isIsoDate, todayInWarsaw, weekStartForDate } from "@/lib/dates"
import { listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ wydarzenie?: string; tydzien?: string }>
}) {
  const user = await requireUser()
  const { wydarzenie, tydzien } = await searchParams
  const today = todayInWarsaw()
  let startDate = addDays(today, -60) // 2 months back for history
  let endDate = addDays(today, 120)  // 4 months forward for planning

  const validWeekParam = tydzien && isIsoDate(tydzien) ? weekStartForDate(tydzien) : undefined

  if (validWeekParam) {
    const targetEnd = addDays(validWeekParam, 7)
    if (validWeekParam < startDate) startDate = addDays(validWeekParam, -14)
    if (targetEnd > endDate) endDate = addDays(targetEnd, 14)
  }

  const [events, users] = await Promise.all([
    listGuildEvents({
      startDate,
      endDate,
      limit: 1000,
      currentUserId: user.id,
    }),
    listUsers(),
  ])

  return (
    <GuildCalendar
      events={events}
      currentUserId={user.id}
      isLeader={user.isLeader}
      allGuildUsers={users.map((u) => ({ id: u.id, gameNick: u.gameNick }))}
      initialEventId={wydarzenie}
      initialWeekStart={validWeekParam}
    />
  )
}
