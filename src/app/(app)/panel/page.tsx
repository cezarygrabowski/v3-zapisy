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

import { hasV3Access } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export default async function PanelPage() {
  const user = await requireUser()
  const hasV3 = hasV3Access(user)
  const date = todayInWarsaw()
  const slot = relevantSlot()

  // Ensure default categories exist
  await ensureDefaultTimerCategories(user.id)

  const [roster, v3Kills, syncs, categories, killStats, users, rawV3Event, feeLock] = await Promise.all([
    hasV3 ? getSlotRoster(date, slot.id) : Promise.resolve([]),
    hasV3 ? listKillsForDate(date) : Promise.resolve([]),
    hasV3 ? listRunSyncs() : Promise.resolve([]),
    listTimerCategoriesWithTimers(),
    hasV3 ? listKillStats(null) : Promise.resolve([]),
    listUsers(),
    hasV3 ? getRelevantV3CalendarEvent() : Promise.resolve(null),
    checkUserFeeLock(user.id),
  ])

  const v3CalendarEvent = (hasV3 && rawV3Event)
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
      hasV3Role={hasV3}
    />
  )
}
