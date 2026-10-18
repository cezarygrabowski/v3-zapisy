"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { getDb, isUniqueViolation } from "@/lib/db"
import { konwojGroupMembers, konwojGroups, konwojPayouts, konwojPrices, konwojWeeks, users } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { isIsoDate, weekStartForDate } from "@/lib/dates"
import { canManageKonwojGroup } from "@/lib/konwoj"
import { requireLeader, requireUser } from "@/lib/session"

const MAX_KK = 1_000_000_000

function parseWeek(weekStart: string): string | null {
  if (!isIsoDate(weekStart)) return null
  return weekStartForDate(weekStart) === weekStart ? weekStart : null
}

/** Admin or the group's treasurer; returns the user or an error message. */
async function requireGroupManager(groupId: string) {
  const user = await requireUser()
  const db = await getDb()
  const [group] = await db.select({ id: konwojGroups.id }).from(konwojGroups).where(eq(konwojGroups.id, groupId))
  if (!group) return "Nie znaleziono drużyny."
  const members = await db
    .select({ userId: konwojGroupMembers.userId, isTreasurer: konwojGroupMembers.isTreasurer })
    .from(konwojGroupMembers)
    .where(and(eq(konwojGroupMembers.groupId, groupId), eq(konwojGroupMembers.userId, user.id)))
  if (!canManageKonwojGroup(user, { members })) return "Tylko skarbnik drużyny lub admin może to zmienić."
  return user
}

export async function toggleKonwojPayout(groupId: string, weekStart: string, userId: string): Promise<ActionResult> {
  const user = await requireGroupManager(groupId)
  if (typeof user === "string") return fail(user)
  const week = parseWeek(weekStart)
  if (!week) return fail("Nieprawidłowy tydzień.")

  const db = await getDb()
  const where = and(eq(konwojPayouts.groupId, groupId), eq(konwojPayouts.weekStart, week), eq(konwojPayouts.userId, userId))
  const [existing] = await db.select({ userId: konwojPayouts.userId }).from(konwojPayouts).where(where)
  if (existing) {
    await db.delete(konwojPayouts).where(where)
  } else {
    await db.insert(konwojPayouts).values({ groupId, weekStart: week, userId, paidBy: user.id })
  }

  revalidatePath("/konwoj")
  return ok(existing ? "Cofnięto wypłatę." : "Oznaczono jako wypłacone.")
}

function parsePrice(priceKk: number | null): number | null | undefined {
  if (priceKk === null) return null
  if (!Number.isFinite(priceKk) || priceKk < 0 || priceKk > MAX_KK) return undefined
  return Math.round(priceKk * 100) / 100
}

/** Weekly state: postać zbierająca drop, czyste yang na postaci + szacowana wartość itemów na shopie. */
export async function setKonwojWeekState(
  groupId: string,
  weekStart: string,
  input: { collectorName: string; yangKk: number; itemsValueKk: number }
): Promise<ActionResult> {
  const user = await requireGroupManager(groupId)
  if (typeof user === "string") return fail(user)
  const week = parseWeek(weekStart)
  if (!week) return fail("Nieprawidłowy tydzień.")
  const shopYangKk = parsePrice(input.yangKk)
  const shopItemsValueKk = parsePrice(input.itemsValueKk)
  if (shopYangKk == null) return fail("Podaj czyste yang w kk.")
  if (shopItemsValueKk == null) return fail("Podaj szacowaną wartość itemów w kk.")
  const collectorName = input.collectorName.trim() || null
  if (collectorName && collectorName.length > 40) return fail("Nazwa postaci może mieć max 40 znaków.")

  const db = await getDb()
  const set = { collectorName, shopYangKk, shopItemsValueKk, updatedBy: user.id, updatedAt: new Date() }
  await db
    .insert(konwojWeeks)
    .values({ groupId, weekStart: week, ...set })
    .onConflictDoUpdate({ target: [konwojWeeks.groupId, konwojWeeks.weekStart], set })

  revalidatePath("/konwoj")
  return ok("Zapisano aktualny stan.")
}

type PriceFields = { marketPriceKk: number | null; guildPriceKk: number | null }

function parsePriceFields(input: Partial<PriceFields>): Partial<PriceFields> | string {
  const out: Partial<PriceFields> = {}
  if (input.marketPriceKk !== undefined) {
    const v = parsePrice(input.marketPriceKk)
    if (v === undefined) return "Nieprawidłowa cena rynkowa."
    out.marketPriceKk = v
  }
  if (input.guildPriceKk !== undefined) {
    const v = parsePrice(input.guildPriceKk)
    if (v === undefined) return "Nieprawidłowa cena gildyjna."
    out.guildPriceKk = v
  }
  return out
}

export async function addKonwojPrice(groupId: string, name: string, input: PriceFields): Promise<ActionResult> {
  const user = await requireGroupManager(groupId)
  if (typeof user === "string") return fail(user)
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) return fail("Podaj nazwę przedmiotu (max 80 znaków).")
  const fields = parsePriceFields(input)
  if (typeof fields === "string") return fail(fields)

  const db = await getDb()
  try {
    await db.insert(konwojPrices).values({ id: crypto.randomUUID(), groupId, name: trimmed, ...fields })
  } catch (error) {
    if (isUniqueViolation(error)) return fail("Ten przedmiot już jest w wycenie.")
    throw error
  }

  revalidatePath("/konwoj")
  return ok(`Dodano „${trimmed}”.`)
}

async function requirePriceManager(id: string) {
  const db = await getDb()
  const [item] = await db.select({ groupId: konwojPrices.groupId }).from(konwojPrices).where(eq(konwojPrices.id, id))
  if (!item) return "Nie znaleziono przedmiotu."
  return requireGroupManager(item.groupId)
}

export async function updateKonwojPrice(id: string, input: Partial<PriceFields>): Promise<ActionResult> {
  const user = await requirePriceManager(id)
  if (typeof user === "string") return fail(user)
  const fields = parsePriceFields(input)
  if (typeof fields === "string") return fail(fields)
  if (Object.keys(fields).length === 0) return fail("Brak zmian.")

  const db = await getDb()
  const [updated] = await db
    .update(konwojPrices)
    .set(fields)
    .where(eq(konwojPrices.id, id))
    .returning({ name: konwojPrices.name })

  revalidatePath("/konwoj")
  return ok(`Zaktualizowano: ${updated.name}.`)
}

export async function deleteKonwojPrice(id: string): Promise<ActionResult> {
  const user = await requirePriceManager(id)
  if (typeof user === "string") return fail(user)
  const db = await getDb()
  await db.delete(konwojPrices).where(eq(konwojPrices.id, id))
  revalidatePath("/konwoj")
  return ok("Usunięto przedmiot z wyceny.")
}

// --- Admin: drużyny ---

export async function createKonwojGroup(name: string): Promise<ActionResult> {
  await requireLeader()
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 40) return fail("Podaj nazwę drużyny (max 40 znaków).")

  const db = await getDb()
  try {
    await db.insert(konwojGroups).values({ id: crypto.randomUUID(), name: trimmed })
  } catch (error) {
    if (isUniqueViolation(error)) return fail("Drużyna o tej nazwie już istnieje.")
    throw error
  }

  revalidatePath("/konwoj")
  revalidatePath("/kalendarz")
  return ok(`Utworzono drużynę „${trimmed}”.`)
}

export async function deleteKonwojGroup(groupId: string): Promise<ActionResult> {
  await requireLeader()
  const db = await getDb()
  await db.delete(konwojGroups).where(eq(konwojGroups.id, groupId))
  revalidatePath("/konwoj")
  revalidatePath("/kalendarz")
  return ok("Usunięto drużynę.")
}

/** Moves a player into a group (or out of all groups with `groupId = null`). */
export async function setKonwojGroupMember(userId: string, groupId: string | null): Promise<ActionResult> {
  await requireLeader()
  const db = await getDb()
  const [user] = await db.select({ gameNick: users.gameNick }).from(users).where(eq(users.id, userId))
  if (!user) return fail("Nie znaleziono gracza.")

  if (groupId === null) {
    await db.delete(konwojGroupMembers).where(eq(konwojGroupMembers.userId, userId))
  } else {
    const [group] = await db.select({ id: konwojGroups.id }).from(konwojGroups).where(eq(konwojGroups.id, groupId))
    if (!group) return fail("Nie znaleziono drużyny.")
    await db
      .insert(konwojGroupMembers)
      .values({ userId, groupId })
      // Moving to another group drops the treasurer role.
      .onConflictDoUpdate({ target: konwojGroupMembers.userId, set: { groupId, isTreasurer: false } })
  }

  revalidatePath("/konwoj")
  revalidatePath("/kalendarz")
  return ok(groupId ? `Przypisano ${user.gameNick} do drużyny.` : `Usunięto ${user.gameNick} z drużyny.`)
}

export async function setKonwojGroupTreasurer(groupId: string, userId: string, isTreasurer: boolean): Promise<ActionResult> {
  await requireLeader()
  const db = await getDb()
  const updated = await db
    .update(konwojGroupMembers)
    .set({ isTreasurer })
    .where(and(eq(konwojGroupMembers.userId, userId), eq(konwojGroupMembers.groupId, groupId)))
    .returning({ userId: konwojGroupMembers.userId })
  if (updated.length === 0) return fail("Skarbnik musi należeć do tej drużyny.")
  revalidatePath("/konwoj")
  return ok(isTreasurer ? "Nadano rolę skarbnika." : "Odebrano rolę skarbnika.")
}
