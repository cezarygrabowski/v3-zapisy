"use server"

import { revalidatePath } from "next/cache"
import { and, desc, eq, ilike, isNull, ne, or } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildEventSignups, userCharacters, users, type UserCharacter } from "@/lib/db/schema"
import { isPlaystyle, type Playstyle } from "@/lib/constants"
import { requireUser } from "@/lib/session"
import { fail, ok, type ActionResult } from "@/lib/actions/result"

export type CharacterItem = {
  id: string
  name: string
  /** null: the character does not go to V3. */
  playstyle: Playstyle | null
  isMain: boolean
  description: string
  createdAt: string
}

const MAX_DESCRIPTION = 60

function toItem(r: UserCharacter): CharacterItem {
  return {
    id: r.id,
    name: r.name,
    playstyle: isPlaystyle(r.playstyle ?? "") ? (r.playstyle as Playstyle) : null,
    isMain: r.isMain,
    description: r.description,
    createdAt: new Date(r.createdAt).toISOString(),
  }
}

/**
 * Returns all characters for a given user.
 * If user has no characters in user_characters yet, automatically seeds one from users table.
 */
export async function listUserCharacters(userId: string): Promise<CharacterItem[]> {
  try {
    const db = await getDb()

    const rows = await db
      .select()
      .from(userCharacters)
      .where(eq(userCharacters.userId, userId))
      .orderBy(desc(userCharacters.isMain), userCharacters.createdAt)

    if (rows.length > 0) {
      return rows.map(toItem)
    }

    // Auto-seed main character from users table if empty
    const [user] = await db
      .select({ id: users.id, gameNick: users.gameNick, playstyle: users.playstyle })
      .from(users)
      .where(eq(users.id, userId))

    if (!user) return []

    const playstyle = isPlaystyle(user.playstyle ?? "") ? (user.playstyle as Playstyle) : null

    try {
      await db
        .insert(userCharacters)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: user.gameNick,
          playstyle,
          isMain: true,
          createdAt: new Date(),
        })
        .onConflictDoNothing()
    } catch (insertErr) {
      console.warn("[characters] Initial character insert warning:", insertErr)
    }

    // Always fetch the actual persisted row for this user
    const seededRows = await db
      .select()
      .from(userCharacters)
      .where(eq(userCharacters.userId, userId))
      .orderBy(desc(userCharacters.isMain), userCharacters.createdAt)

    if (seededRows.length > 0) {
      return seededRows.map(toItem)
    }

    // If still empty (e.g. name collided with another user's character), insert with a unique suffix
    try {
      const fallbackName = `${user.gameNick} (${user.id.slice(0, 5)})`
      await db
        .insert(userCharacters)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: fallbackName,
          playstyle,
          isMain: true,
          createdAt: new Date(),
        })
        .onConflictDoNothing()

      const retryRows = await db
        .select()
        .from(userCharacters)
        .where(eq(userCharacters.userId, userId))
        .orderBy(desc(userCharacters.isMain), userCharacters.createdAt)

      if (retryRows.length > 0) {
        return retryRows.map(toItem)
      }
    } catch (fallbackErr) {
      console.warn("[characters] Fallback character insert warning:", fallbackErr)
    }

    return []
  } catch (error) {
    console.error("[characters] listUserCharacters error:", error)
    return []
  }
}

/**
 * Adds a new additional character to the logged in user's account.
 */
export async function addCharacter(input: {
  name: string
  playstyle: Playstyle | null
  description?: string
}): Promise<ActionResult<{ character: CharacterItem }>> {
  const user = await requireUser()
  const name = input.name.trim()
  const description = (input.description ?? "").trim()
  if (description.length > MAX_DESCRIPTION) return fail(`Opis może mieć najwyżej ${MAX_DESCRIPTION} znaków.`)

  if (!name || name.length < 2 || name.length > 24) {
    return fail("Nick postaci musi mieć od 2 do 24 znaków.")
  }

  if (input.playstyle !== null && !isPlaystyle(input.playstyle)) {
    return fail("Wybierz poprawny typ postaci (PVP lub PVM).")
  }

  const db = await getDb()

  // Check name uniqueness globally in user_characters
  const [existingChar] = await db
    .select({ id: userCharacters.id })
    .from(userCharacters)
    .where(eq(userCharacters.name, name))

  if (existingChar) {
    return fail("Taki nick postaci jest już zajęty przez innego gracza.")
  }

  // Ensure user has at least one character. If this is their first, make it main.
  const existingUserChars = await db
    .select({ id: userCharacters.id, isMain: userCharacters.isMain })
    .from(userCharacters)
    .where(eq(userCharacters.userId, user.id))

  const isMain = existingUserChars.length === 0

  const charId = crypto.randomUUID()
  const now = new Date()

  await db.insert(userCharacters).values({
    id: charId,
    userId: user.id,
    name,
    playstyle: input.playstyle,
    isMain,
    description,
    createdAt: now,
  })

  // If this was marked main, sync users table
  if (isMain) {
    await db
      .update(users)
      .set({ gameNick: name, playstyle: input.playstyle })
      .where(eq(users.id, user.id))
  }

  revalidatePath("/", "layout")
  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")

  return ok("Dodano postać.", {
    character: {
      id: charId,
      name,
      playstyle: input.playstyle,
      isMain,
      description,
      createdAt: now.toISOString(),
    },
  })
}

/**
 * Updates an existing character's name or playstyle.
 */
export async function updateCharacter(input: {
  characterId: string
  name: string
  playstyle: Playstyle | null
  description: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const name = input.name.trim()
  const description = input.description.trim()
  if (description.length > MAX_DESCRIPTION) return fail(`Opis może mieć najwyżej ${MAX_DESCRIPTION} znaków.`)

  if (!name || name.length < 2 || name.length > 24) {
    return fail("Nick postaci musi mieć od 2 do 24 znaków.")
  }

  if (input.playstyle !== null && !isPlaystyle(input.playstyle)) {
    return fail("Wybierz poprawny typ postaci (PVP lub PVM).")
  }

  const db = await getDb()

  // Verify ownership
  const [char] = await db
    .select()
    .from(userCharacters)
    .where(eq(userCharacters.id, input.characterId))

  if (!char || char.userId !== user.id) {
    return fail("Nie znaleziono postaci lub brak uprawnień.")
  }

  // Check if new name is taken by another character
  if (name.toLowerCase() !== char.name.toLowerCase()) {
    const [existingChar] = await db
      .select({ id: userCharacters.id })
      .from(userCharacters)
      .where(and(eq(userCharacters.name, name), ne(userCharacters.id, input.characterId)))

    if (existingChar) {
      return fail("Taki nick postaci jest już zajęty.")
    }
  }

  await db
    .update(userCharacters)
    .set({ name, playstyle: input.playstyle, description })
    .where(eq(userCharacters.id, input.characterId))

  // If this character is main, sync users table
  if (char.isMain) {
    await db
      .update(users)
      .set({ gameNick: name, playstyle: input.playstyle })
      .where(eq(users.id, user.id))
  }

  // Without a V3 type the signup keeps its role; only the name follows.
  const role = input.playstyle ? { role: input.playstyle === "pvp" ? "PvP" : "PvM" } : {}

  // Update signups for this character
  await db
    .update(guildEventSignups)
    .set({ characterName: name, ...role })
    .where(
      and(
        eq(guildEventSignups.characterId, input.characterId),
        or(
          isNull(guildEventSignups.role),
          ilike(guildEventSignups.role, "pvp"),
          ilike(guildEventSignups.role, "pvm")
        )
      )
    )

  // If main, also update signups where characterId was not set (legacy/unlinked signups)
  if (char.isMain) {
    await db
      .update(guildEventSignups)
      .set({ characterName: name, ...role })
      .where(
        and(
          eq(guildEventSignups.userId, user.id),
          isNull(guildEventSignups.characterId),
          or(
            isNull(guildEventSignups.role),
            ilike(guildEventSignups.role, "pvp"),
            ilike(guildEventSignups.role, "pvm")
          )
        )
      )
  }

  revalidatePath("/", "layout")
  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")

  return ok("Zaktualizowano postać.")
}

/**
 * Sets a specific character as the user's primary/main character.
 */
export async function setMainCharacter(input: { characterId: string }): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [char] = await db
    .select()
    .from(userCharacters)
    .where(eq(userCharacters.id, input.characterId))

  if (!char || char.userId !== user.id) {
    return fail("Nie znaleziono postaci lub brak uprawnień.")
  }

  // Unmark all other characters of this user
  await db
    .update(userCharacters)
    .set({ isMain: false })
    .where(eq(userCharacters.userId, user.id))

  // Mark this character as main
  await db
    .update(userCharacters)
    .set({ isMain: true })
    .where(eq(userCharacters.id, input.characterId))

  // Sync users table gameNick and playstyle
  await db
    .update(users)
    .set({ gameNick: char.name, playstyle: char.playstyle })
    .where(eq(users.id, user.id))

  revalidatePath("/", "layout")
  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")

  return ok(`Ustawiono postać „${char.name}” jako główną.`)
}

/**
 * Deletes a secondary character. The main character cannot be deleted.
 */
export async function deleteCharacter(input: { characterId: string }): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()

  const [char] = await db
    .select()
    .from(userCharacters)
    .where(eq(userCharacters.id, input.characterId))

  if (!char || char.userId !== user.id) {
    return fail("Nie znaleziono postaci lub brak uprawnień.")
  }

  if (char.isMain) {
    return fail("Nie możesz usunąć postaci głównej. Najpierw ustaw inną postać jako główną.")
  }

  await db.delete(userCharacters).where(eq(userCharacters.id, input.characterId))

  revalidatePath("/", "layout")
  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")

  return ok(`Usunięto postać „${char.name}”.`)
}
