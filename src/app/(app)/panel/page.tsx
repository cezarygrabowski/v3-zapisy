import { PanelHub } from "@/components/panel/panel-hub"
import { getRelevantV3CalendarEvent } from "@/lib/calendar-queries"
import { slotLabel } from "@/lib/constants"
import { relevantSlot, todayInWarsaw } from "@/lib/dates"
import { getSlotRoster, listKillStats, listKillsForDate, listRunSyncs, listUsers } from "@/lib/queries"
import { requireUser } from "@/lib/session"
import { checkUserFeeLock } from "@/lib/settings"
import {
  ensureDefaultTimerCategories,
  listTimerCategoriesWithTimers,
} from "@/lib/timers-queries"

export const dynamic = "force-dynamic"

export default async function PanelPage() {
  const user = await requireUser()
  const date = todayInWarsaw()
  const slot = relevantSlot()

  // Ensure default categories exist
  await ensureDefaultTimerCategories(user.id)

  const [roster, v3Kills, syncs, categories, killStats, users, rawV3Event, feeLock] = await Promise.all([
    getSlotRoster(date, slot.id),
    listKillsForDate(date),
    listRunSyncs(),
    listTimerCategoriesWithTimers(),
    listKillStats(null),
    listUsers(),
    getRelevantV3CalendarEvent(),
    checkUserFeeLock(user.id),
  ])

  const v3CalendarEvent = rawV3Event
    ? { ...rawV3Event, currentUserFeeLock: feeLock }
    : null

  return (
    <PanelHub
      slot={{ ...slot, label: slotLabel(slot.id) }}
      roster={roster}
      v3Kills={v3Kills}
      syncs={syncs}
      categories={categories}
      v3CalendarEvent={v3CalendarEvent}
      queenCounts={killStats.map((row) => ({
        userId: row.userId,
        queens: row.queens,
      }))}
      users={users.map((u) => ({ id: u.id, gameNick: u.gameNick }))}
      currentUserId={user.id}
      currentUserNick={user.gameNick}
      isLeader={user.isLeader}
    />
  )
}
