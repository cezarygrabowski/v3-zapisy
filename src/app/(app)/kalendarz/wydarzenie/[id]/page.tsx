import { notFound } from "next/navigation"
import { EventDetailView } from "@/components/calendar/event-detail-view"
import { getGuildEventDetails } from "@/lib/calendar-queries"
import { listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params

  const [event, guildUsers] = await Promise.all([
    getGuildEventDetails(id),
    listUsers(),
  ])

  if (!event) {
    notFound()
  }

  return (
    <EventDetailView
      event={event}
      currentUserId={user.id}
      isLeader={user.isLeader}
      allGuildUsers={guildUsers.map((u) => ({ id: u.id, gameNick: u.gameNick }))}
    />
  )
}
