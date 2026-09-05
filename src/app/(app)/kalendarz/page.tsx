import { GuildCalendar } from "@/components/calendar/guild-calendar"
import { listGuildEvents } from "@/lib/calendar-queries"
import { listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const user = await requireUser()
  const [events, users] = await Promise.all([
    listGuildEvents({ limit: 100, currentUserId: user.id }),
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
