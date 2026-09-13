import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { hasV3Access } from "@/lib/permissions"
import { getV3Enemies } from "@/lib/actions/enemies"
import { getRelevantV3CalendarEvent } from "@/lib/calendar-queries"
import { listKillsForDate, listRunSyncs } from "@/lib/queries"
import { todayInWarsaw } from "@/lib/dates"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasV3Access(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const date = todayInWarsaw()

    // Parallel lightweight fetch
    const [v3Enemies, rawV3Event, kills, syncs] = await Promise.all([
      getV3Enemies(),
      getRelevantV3CalendarEvent(),
      listKillsForDate(date),
      listRunSyncs(),
    ])

    return NextResponse.json({
      ok: true,
      timestamp: Date.now(),
      v3Enemies,
      v3CalendarEvent: rawV3Event,
      kills,
      syncs,
    })
  } catch (error) {
    console.error("[GET /api/panel/v3-live] Error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
