"use server"

import { revalidatePath } from "next/cache"
import { eq, inArray } from "drizzle-orm"
import { getDb, isUniqueViolation } from "@/lib/db"
import { guildAdmins, guilds, userCharacters, users } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { requireSuperAdmin } from "@/lib/session"

function refresh() {
  revalidatePath("/admin", "layout")
  revalidatePath("/postep")
}

export async function createGuild(name: string): Promise<ActionResult> {
  await requireSuperAdmin()
  const clean = name.trim()
  if (clean.length < 2 || clean.length > 32) return fail("Nazwa gildii musi mieć 2–32 znaki.")
  const db = await getDb()
  try {
    await db.insert(guilds).values({ id: crypto.randomUUID(), name: clean })
  } catch (error) {
    if (isUniqueViolation(error)) return fail("Taka gildia już istnieje.")
    throw error
  }
  refresh()
  return ok(`Dodano gildię ${clean}.`)
}

/** Its characters become guild-less and its admins lose it; nothing else is deleted. */
export async function deleteGuild(guildId: string): Promise<ActionResult> {
  await requireSuperAdmin()
  const db = await getDb()
  await db.delete(guilds).where(eq(guilds.id, guildId))
  refresh()
  return ok("Usunięto gildię.")
}

export async function setCharacterGuild(characterId: string, guildId: string | null): Promise<ActionResult> {
  await requireSuperAdmin()
  const db = await getDb()
  if (guildId && !(await db.select({ id: guilds.id }).from(guilds).where(eq(guilds.id, guildId))).length)
    return fail("Nie ma takiej gildii.")
  await db.update(userCharacters).set({ guildId }).where(eq(userCharacters.id, characterId))
  refresh()
  return ok("Zapisano gildię postaci.")
}

/** Granting admin always names its guilds; an empty list takes admin away. */
export async function setAdminGuilds(userId: string, guildIds: string[]): Promise<ActionResult> {
  await requireSuperAdmin()
  const db = await getDb()
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!target || target.deletedAt) return fail("Nie znaleziono gracza.")
  if (target.isSuperAdmin) return fail("Super admin widzi wszystkie gildie.")
  const ids = [...new Set(guildIds)]
  const known = ids.length ? await db.select({ id: guilds.id }).from(guilds).where(inArray(guilds.id, ids)) : []
  if (known.length !== ids.length) return fail("Nie ma takiej gildii.")

  await db.transaction(async (tx) => {
    await tx.delete(guildAdmins).where(eq(guildAdmins.userId, userId))
    if (ids.length) await tx.insert(guildAdmins).values(ids.map((guildId) => ({ userId, guildId })))
    await tx
      .update(users)
      .set({ isLeader: ids.length > 0 })
      .where(eq(users.id, userId))
  })
  revalidatePath("/", "layout")
  refresh()
  return ok(ids.length ? `${target.gameNick} jest adminem.` : `Zabrano admina graczowi ${target.gameNick}.`)
}
