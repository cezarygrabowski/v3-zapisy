"use server"

import { revalidatePath } from "next/cache"
import { formatTimeWarsaw } from "@/lib/dates"
import { getDb } from "@/lib/db"
import { customTimerKills, customTimers, timerCategories } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { eq } from "drizzle-orm"

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }

function ok(message?: string): ActionResult {
  return { ok: true, message }
}

function fail(error: string): ActionResult {
  return { ok: false, error }
}

export async function createTimerCategory(input: {
  name: string
  icon?: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const name = input.name.trim()
  if (!name) return fail("Nazwa mapy/kategorii nie może być pusta.")

  const icon = (input.icon ?? "").trim() || "🗺️"

  const db = await getDb()
  await db.insert(timerCategories).values({
    id: crypto.randomUUID(),
    name,
    icon,
    createdBy: user.id,
  })

  revalidatePath("/timery")
  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  return ok(`Dodano nową mapę: ${name}`)
}

export async function deleteTimerCategory(categoryId: string): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [cat] = await db
    .select({ id: timerCategories.id, createdBy: timerCategories.createdBy })
    .from(timerCategories)
    .where(eq(timerCategories.id, categoryId))

  if (!cat) return fail("Nie znaleziono kategorii.")
  if (!user.isLeader && cat.createdBy !== user.id) {
    return fail("Brak uprawnień do usunięcia tej mapy.")
  }

  await db.delete(timerCategories).where(eq(timerCategories.id, categoryId))
  revalidatePath("/timery")
  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  return ok("Usunięto mapę i powiązane z nią timery.")
}

export async function createCustomTimer(input: {
  categoryId: string
  name: string
  channelsCount?: number
  respawnMinMinutes?: number
  respawnMaxMinutes?: number
  notes?: string
}): Promise<ActionResult> {
  const user = await requireUser()
  if (!user.isLeader) {
    return fail("Tylko admin może dodawać timery.")
  }

  const name = input.name.trim()
  if (!name) return fail("Nazwa bossa nie może być pusta.")

  const channelsCount = Math.max(1, Math.min(9, Math.round(input.channelsCount || 5)))
  const respawnMin = Math.max(1, Math.min(1440, Math.round(input.respawnMinMinutes || 48)))
  const respawnMax = Math.max(respawnMin, Math.min(1440, Math.round(input.respawnMaxMinutes || 52)))

  const db = await getDb()
  await db.insert(customTimers).values({
    id: crypto.randomUUID(),
    categoryId: input.categoryId,
    name,
    channelsCount,
    respawnMinMinutes: respawnMin,
    respawnMaxMinutes: respawnMax,
    notes: input.notes?.trim() || null,
    createdBy: user.id,
  })

  revalidatePath("/timery")
  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  return ok(`Dodano bossa/timer: ${name}`)
}

export async function updateCustomTimer(input: {
  timerId: string
  name: string
  channelsCount: number
  respawnMinMinutes: number
  respawnMaxMinutes: number
  notes?: string
}): Promise<ActionResult> {
  const user = await requireUser()
  if (!user.isLeader) {
    return fail("Tylko admin może konfigurować parametry bossów.")
  }

  const name = input.name.trim()
  if (!name) return fail("Nazwa bossa nie może być pusta.")

  const channelsCount = Math.max(1, Math.min(9, Math.round(input.channelsCount || 5)))
  const respawnMin = Math.max(1, Math.min(1440, Math.round(input.respawnMinMinutes || 48)))
  const respawnMax = Math.max(respawnMin, Math.min(1440, Math.round(input.respawnMaxMinutes || 52)))

  const db = await getDb()
  const [t] = await db
    .select({ id: customTimers.id })
    .from(customTimers)
    .where(eq(customTimers.id, input.timerId))

  if (!t) return fail("Nie znaleziono timera.")

  await db
    .update(customTimers)
    .set({
      name,
      channelsCount,
      respawnMinMinutes: respawnMin,
      respawnMaxMinutes: respawnMax,
      notes: input.notes?.trim() || null,
    })
    .where(eq(customTimers.id, input.timerId))

  revalidatePath("/timery")
  revalidatePath("/panel")
  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  return ok(`Zaktualizowano parametry bossa: ${name}`)
}

export async function deleteCustomTimer(timerId: string): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [t] = await db
    .select({ id: customTimers.id, createdBy: customTimers.createdBy })
    .from(customTimers)
    .where(eq(customTimers.id, timerId))

  if (!t) return fail("Nie znaleziono timera.")
  if (!user.isLeader && t.createdBy !== user.id) {
    return fail("Brak uprawnień do usunięcia tego timera.")
  }

  await db.delete(customTimers).where(eq(customTimers.id, timerId))
  revalidatePath("/timery")
  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  return ok("Usunięto timer.")
}

export async function recordCustomTimerKill(input: {
  timerId: string
  channel: number
  customTime?: string // HH:MM:SS or HH:MM
}): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [timer] = await db
    .select({ id: customTimers.id, name: customTimers.name })
    .from(customTimers)
    .where(eq(customTimers.id, input.timerId))

  if (!timer) return fail("Nie znaleziono timera.")

  let killedAt = new Date()
  let killedAtLabel = formatTimeWarsaw(killedAt)

  if (input.customTime && /^\d{1,2}:\d{2}(:\d{2})?$/.test(input.customTime)) {
    const parts = input.customTime.split(":").map(Number)
    const customDate = new Date()
    customDate.setHours(parts[0], parts[1], parts[2] || 0, 0)
    killedAt = customDate
    killedAtLabel = input.customTime
  }

  await db.insert(customTimerKills).values({
    id: crypto.randomUUID(),
    timerId: input.timerId,
    channel: input.channel,
    killedAt,
    killedAtLabel,
    reportedBy: user.id,
  })

  revalidatePath("/timery")
  revalidatePath("/panel")
  return ok(`Zapisano zbicie: ${timer.name} (CH${input.channel}) o ${killedAtLabel}`)
}

export async function undoCustomTimerKill(killId: string): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [kill] = await db
    .select({ id: customTimerKills.id, reportedBy: customTimerKills.reportedBy })
    .from(customTimerKills)
    .where(eq(customTimerKills.id, killId))

  if (!kill) return fail("Nie znaleziono wpisu.")
  if (!user.isLeader && kill.reportedBy !== user.id) {
    return fail("Możesz cofnąć tylko własne zaraportowane zbicie.")
  }

  await db.delete(customTimerKills).where(eq(customTimerKills.id, killId))
  revalidatePath("/timery")
  revalidatePath("/panel")
  return ok("Cofnięto wpis zbicia.")
}
