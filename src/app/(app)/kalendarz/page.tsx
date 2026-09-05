import { GuildCalendar } from "@/components/calendar/guild-calendar"
import { listGuildEvents } from "@/lib/calendar-queries"
import { addDays, todayInWarsaw } from "@/lib/dates"
import { listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const user = await requireUser()
  const today = todayInWarsaw()
  const startDate = addDays(today, -60) // 2 months back for history
  const endDate = addDays(today, 120)  // 4 months forward for planning

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
    />
  )
}
