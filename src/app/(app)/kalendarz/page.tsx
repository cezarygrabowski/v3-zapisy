import { GuildCalendar } from "@/components/calendar/guild-calendar"
import { listGuildEvents } from "@/lib/calendar-queries"
import { addDays, isIsoDate, todayInWarsaw, weekStartForDate } from "@/lib/dates"
import { listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"

import { hasV3Access } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ wydarzenie?: string; tydzien?: string }>
}) {
  const user = await requireUser()
  const hasV3 = hasV3Access(user)
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

  const { getSignupAdvanceDays, getSignupOpenTime } = await import("@/lib/settings")
  const { getActivePenaltyForUser } = await import("@/lib/actions/penalties")

  const [rawEvents, users, signupAdvanceDays, signupOpenTime, activePenalty] = await Promise.all([
    listGuildEvents({
      startDate,
      endDate,
      limit: 1000,
      currentUserId: user.id,
    }),
    listUsers(),
    getSignupAdvanceDays(),
    getSignupOpenTime(),
    getActivePenaltyForUser(user.id),
  ])

  // If user does not have V3 access, mask V3 events (keep them visible as scheduled, but hide counts, spots and description)
  const events = rawEvents.map((evt) => {
    if (evt.type === "v3" && !hasV3) {
      return {
        ...evt,
        description: null,
        totalSignups: 0,
        uniqueUsersCount: 0,
        mySignup: null,
      }
    }
    return evt
  })

  return (
    <GuildCalendar
      events={events}
      currentUserId={user.id}
      isLeader={user.isLeader}
      hasV3Role={hasV3}
      allGuildUsers={users.map((u) => ({ id: u.id, gameNick: u.gameNick }))}
      initialEventId={wydarzenie}
      initialWeekStart={validWeekParam}
      signupAdvanceDays={signupAdvanceDays}
      signupOpenTime={signupOpenTime}
      userAllowedAdvanceDays={activePenalty ? activePenalty.allowedAdvanceDays : undefined}
    />
  )
}
