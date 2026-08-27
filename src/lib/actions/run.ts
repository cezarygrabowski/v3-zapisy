"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import {
  currentSlotId,
  formatTimeWarsaw,
  isHms,
  todayInWarsaw,
  warsawWallToDate,
} from "@/lib/dates"
import { getDb } from "@/lib/db"
import { runKillHelpers, runKills, runSyncs } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { requireUser } from "@/lib/session"

function revalidateRun() {
  revalidatePath("/run")
  revalidatePath("/statystyki")
}

function stamp() {
  const now = new Date()
  return {
    now,
    date: todayInWarsaw(now),
    slot: currentSlotId(now),
    label: formatTimeWarsaw(now),
  }
}

async function upsertSync(
  db: Awaited<ReturnType<typeof getDb>>,
  kind: string,
  syncedAt: Date,
  label: string,
  userId: string
) {
  await db
    .insert(runSyncs)
    .values({
      kind,
      syncedAt,
      syncedAtLabel: label,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: runSyncs.kind,
      set: {
        syncedAt,
        syncedAtLabel: label,
        updatedBy: userId,
      },
    })
}

export async function recordQueenKill(): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()
  const { now, date, slot, label } = stamp()
  await db.insert(runKills).values({
    id: crypto.randomUUID(),
    kind: "queen",
    reportedBy: user.id,
    killedAt: now,
    killedAtLabel: label,
    date,
    slot,
  })
  revalidateRun()
  return ok(`Królówka ${label}`)
}

export async function recordBaronKill(helperIds: string[]): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()
  const { now, date, slot, label } = stamp()
  const killId = crypto.randomUUID()
  await db.insert(runKills).values({
    id: killId,
    kind: "baron",
    reportedBy: user.id,
    killedAt: now,
    killedAtLabel: label,
    date,
    slot,
  })

  const uniqueHelpers = [...new Set(helperIds.filter((id) => id && id !== user.id))]
  if (uniqueHelpers.length > 0) {
    await db.insert(runKillHelpers).values(
      uniqueHelpers.map((userId) => ({
        killId,
        userId,
      }))
    )
  }

  revalidateRun()
  return ok(`Baronka ${label}`)
}

export async function undoKill(killId: string): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()
  const kill = await db.query.runKills.findFirst({
    where: eq(runKills.id, killId),
  })
  if (!kill) return fail("Nie znaleziono zbicia.")

  const ageMs = Date.now() - new Date(kill.killedAt).getTime()
  const ownRecent = kill.reportedBy === user.id && ageMs <= 2 * 60 * 1000
  if (!user.isLeader && !ownRecent) {
    return fail("Cofnąć można własne zbicia z ostatnich 2 minut (admin — zawsze).")
  }

  await db.delete(runKillHelpers).where(eq(runKillHelpers.killId, killId))
  await db.delete(runKills).where(eq(runKills.id, killId))
  revalidateRun()
  return ok("Cofnięto")
}

const SYNC_KINDS = ["cocoons", "nets"] as const
export type SyncKind = (typeof SYNC_KINDS)[number]

export async function syncRunTimer(kind: string, timeHms: string): Promise<ActionResult> {
  const user = await requireUser()
  if (!SYNC_KINDS.includes(kind as SyncKind)) return fail("Nieznany timer.")

  const now = new Date()
  const label = timeHms.trim() === "" ? formatTimeWarsaw(now) : timeHms.trim()
  if (!isHms(label)) return fail("Czas w formacie HH:MM:SS.")

  const syncedAt = warsawWallToDate(todayInWarsaw(now), label)
  if (!syncedAt) return fail("Nie udało się odczytać godziny.")

  const db = await getDb()
  await upsertSync(db, kind, syncedAt, label, user.id)

  revalidatePath("/run")
  return ok(`Sync ${label}`)
}
