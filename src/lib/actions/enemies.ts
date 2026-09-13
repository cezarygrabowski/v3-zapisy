"use server"

import { revalidatePath } from "next/cache"
import { eq, desc } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { v3Enemies, users } from "@/lib/db/schema"
import { requireUser, requireLeader } from "@/lib/session"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import type { QuickAddEnemyInput, UpdateEnemyInput, V3EnemyItem } from "@/lib/enemy-types"
import { notifyV3EnemySpotted } from "@/lib/discord"

function safeRevalidate() {
  try {
    revalidatePath("/panel")
  } catch {
    // Ignored outside Next.js request context (e.g. unit tests)
  }
}

/**
 * Retrieves all registered enemies, ordered with those currently inside V3 first,
 * followed by newest or alphabetical.
 */
export async function getV3Enemies(): Promise<V3EnemyItem[]> {
  try {
    const db = await getDb()
    const rows = await db
      .select({
        id: v3Enemies.id,
        name: v3Enemies.name,
        guild: v3Enemies.guild,
        characterClass: v3Enemies.characterClass,
        isInsideV3: v3Enemies.isInsideV3,
        spottedAt: v3Enemies.spottedAt,
        spottedBy: v3Enemies.spottedBy,
        spotterNick: users.gameNick,
        createdAt: v3Enemies.createdAt,
      })
      .from(v3Enemies)
      .leftJoin(users, eq(v3Enemies.spottedBy, users.id))
      .orderBy(desc(v3Enemies.isInsideV3), v3Enemies.name)

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      guild: r.guild,
      characterClass: r.characterClass,
      isInsideV3: r.isInsideV3,
      spottedAt: r.spottedAt ? new Date(r.spottedAt).toISOString() : null,
      spottedBy: r.spottedBy,
      spotterNick: r.spotterNick ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    }))
  } catch (err) {
    console.error("[getV3Enemies] Error loading enemies:", err)
    return []
  }
}

/**
 * Ultra-fast 1-click toggle:
 * Flips `isInsideV3` between true and false.
 * If set to true, updates `spottedAt = now()` and `spottedBy = currentUserId`.
 */
export async function toggleV3EnemyStatus(
  enemyId: string,
  options?: { actorUserId?: string }
): Promise<ActionResult<{ isInsideV3: boolean }>> {
  let userId = options?.actorUserId
  if (!userId) {
    const user = await requireUser()
    userId = user.id
  }
  const db = await getDb()

  const [enemy] = await db
    .select({
      id: v3Enemies.id,
      name: v3Enemies.name,
      guild: v3Enemies.guild,
      characterClass: v3Enemies.characterClass,
      isInsideV3: v3Enemies.isInsideV3,
    })
    .from(v3Enemies)
    .where(eq(v3Enemies.id, enemyId))
    .limit(1)

  if (!enemy) {
    return fail("Nie znaleziono wroga o podanym ID.")
  }

  const nextStatus = !enemy.isInsideV3
  const now = new Date()

  await db
    .update(v3Enemies)
    .set({
      isInsideV3: nextStatus,
      spottedAt: nextStatus ? now : null,
      spottedBy: nextStatus ? userId : null,
    })
    .where(eq(v3Enemies.id, enemyId))

  if (nextStatus) {
    // Send Discord notification in background if enemy entered V3
    let spotterNick = "Ktoś z gildii"
    try {
      const [u] = await db
        .select({ gameNick: users.gameNick })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      if (u?.gameNick) spotterNick = u.gameNick
    } catch {
      // ignore
    }

    void notifyV3EnemySpotted({
      enemyName: enemy.name,
      guild: enemy.guild,
      spotterNick,
    })
  }

  safeRevalidate()
  return ok(
    nextStatus ? `Oznaczono wroga ${enemy.name} jako obecnego w V3!` : `Odznaczono wroga ${enemy.name} (zszedł z V3).`,
    { isInsideV3: nextStatus }
  )
}

/**
 * Quick-adds a new enemy to the database (and optionally marks them inside V3 immediately).
 */
export async function quickAddV3Enemy(
  input: QuickAddEnemyInput,
  options?: { actorUserId?: string; actorNick?: string }
): Promise<ActionResult<V3EnemyItem>> {
  let userId = options?.actorUserId
  let userNick = options?.actorNick
  if (!userId) {
    const user = await requireUser()
    userId = user.id
    userNick = user.gameNick
  }
  const cleanName = input.name?.trim()
  if (!cleanName || cleanName.length < 2) {
    return fail("Podaj prawidłowy nick wroga (min. 2 znaki).")
  }

  const db = await getDb()
  const cleanGuild = input.guild?.trim() || null
  const cleanClass = input.characterClass?.trim() || null
  const markInside = Boolean(input.markInside)
  const now = new Date()

  // Check if enemy already exists (case-insensitive)
  const [existing] = await db
    .select({
      id: v3Enemies.id,
      name: v3Enemies.name,
      isInsideV3: v3Enemies.isInsideV3,
    })
    .from(v3Enemies)
    .where(eq(v3Enemies.name, cleanName))
    .limit(1)

  if (existing) {
    // If enemy already exists, just update their status if requested
    if (markInside && !existing.isInsideV3) {
      await db
        .update(v3Enemies)
        .set({
          isInsideV3: true,
          spottedAt: now,
          spottedBy: userId,
          guild: cleanGuild || undefined,
        })
        .where(eq(v3Enemies.id, existing.id))

      void notifyV3EnemySpotted({
        enemyName: existing.name,
        guild: cleanGuild,
        spotterNick: userNick || "Ktoś z gildii",
      })
    }
    safeRevalidate()
    return ok(`Wróg „${cleanName}” był już na liście. Zaktualizowano status!`)
  }

  const id = crypto.randomUUID()
  await db.insert(v3Enemies).values({
    id,
    name: cleanName,
    guild: cleanGuild,
    characterClass: cleanClass,
    isInsideV3: markInside,
    spottedAt: markInside ? now : null,
    spottedBy: markInside ? userId : null,
    createdAt: now,
  })

  if (markInside) {
    void notifyV3EnemySpotted({
      enemyName: cleanName,
      guild: cleanGuild,
      spotterNick: userNick || "Ktoś z gildii",
    })
  }

  safeRevalidate()
  return ok(
    markInside ? `Dodano wroga ${cleanName} i oznaczono w V3!` : `Dodano wroga ${cleanName} do listy.`,
    {
      id,
      name: cleanName,
      guild: cleanGuild,
      characterClass: cleanClass,
      isInsideV3: markInside,
      spottedAt: markInside ? now.toISOString() : null,
      spottedBy: markInside ? userId : null,
      spotterNick: markInside ? userNick : null,
      createdAt: now.toISOString(),
    }
  )
}

/**
 * Resets all enemies to isInsideV3 = false ("Wszyscy zeszli / Czysto").
 */
export async function clearAllV3Enemies(options?: { skipAuth?: boolean }): Promise<ActionResult> {
  if (!options?.skipAuth) {
    await requireUser()
  }
  const db = await getDb()

  await db
    .update(v3Enemies)
    .set({
      isInsideV3: false,
      spottedAt: null,
      spottedBy: null,
    })
    .where(eq(v3Enemies.isInsideV3, true))

  safeRevalidate()
  return ok("Zresetowano status wrogów. V3 oznaczone jako czyste!")
}

/**
 * Edits an enemy's details (name, guild, characterClass).
 */
export async function updateV3Enemy(
  input: UpdateEnemyInput,
  options?: { skipAuth?: boolean }
): Promise<ActionResult<V3EnemyItem>> {
  if (!options?.skipAuth) {
    await requireUser()
  }

  const cleanId = input.id?.trim()
  const cleanName = input.name?.trim()
  if (!cleanId) {
    return fail("Brak ID wroga do edycji.")
  }
  if (!cleanName || cleanName.length < 2) {
    return fail("Podaj prawidłowy nick wroga (min. 2 znaki).")
  }

  const db = await getDb()
  const cleanGuild = input.guild?.trim() || null
  const cleanClass = input.characterClass?.trim() || null

  const [existing] = await db
    .select()
    .from(v3Enemies)
    .where(eq(v3Enemies.id, cleanId))
    .limit(1)

  if (!existing) {
    return fail("Nie znaleziono wroga o podanym ID.")
  }

  await db
    .update(v3Enemies)
    .set({
      name: cleanName,
      guild: cleanGuild,
      characterClass: cleanClass,
    })
    .where(eq(v3Enemies.id, cleanId))

  safeRevalidate()
  return ok(`Zaktualizowano dane wroga „${cleanName}”!`, {
    id: existing.id,
    name: cleanName,
    guild: cleanGuild,
    characterClass: cleanClass,
    isInsideV3: existing.isInsideV3,
    spottedAt: existing.spottedAt ? new Date(existing.spottedAt).toISOString() : null,
    spottedBy: existing.spottedBy,
    createdAt: new Date(existing.createdAt).toISOString(),
  })
}

/**
 * Permanently removes an enemy from the roster.
 */
export async function deleteV3Enemy(enemyId: string, options?: { skipAuth?: boolean }): Promise<ActionResult> {
  if (!options?.skipAuth) {
    await requireLeader()
  }
  const db = await getDb()

  await db.delete(v3Enemies).where(eq(v3Enemies.id, enemyId))
  safeRevalidate()
  return ok("Usunięto wroga z listy.")
}

