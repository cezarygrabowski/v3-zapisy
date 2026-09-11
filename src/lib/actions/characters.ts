"use server"

import { revalidatePath } from "next/cache"
import { and, desc, eq, ne } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { userCharacters, users, type UserCharacter } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { fail, ok, type ActionResult } from "@/lib/actions/result"

export type CharacterItem = {
  id: string
  name: string
  playstyle: "pvp" | "pvm"
  isMain: boolean
  createdAt: string
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
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        playstyle: (r.playstyle as "pvp" | "pvm") || "pvm",
        isMain: r.isMain,
        createdAt: new Date(r.createdAt).toISOString(),
      }))
    }

    // Auto-seed main character from users table if empty
    const [user] = await db
      .select({ id: users.id, gameNick: users.gameNick, playstyle: users.playstyle })
      .from(users)
      .where(eq(users.id, userId))

    if (!user) return []

    const charId = crypto.randomUUID()
    const playstyle = (user.playstyle as "pvp" | "pvm") || "pvm"
    await db.insert(userCharacters).values({
      id: charId,
      userId: user.id,
      name: user.gameNick,
      playstyle,
      isMain: true,
      createdAt: new Date(),
    }).onConflictDoNothing()

    return [
      {
        id: charId,
        name: user.gameNick,
        playstyle,
        isMain: true,
        createdAt: new Date().toISOString(),
      },
    ]
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
  playstyle: "pvp" | "pvm"
}): Promise<ActionResult<{ character: CharacterItem }>> {
  const user = await requireUser()
  const name = input.name.trim()

  if (!name || name.length < 2 || name.length > 24) {
    return fail("Nick postaci musi mieć od 2 do 24 znaków.")
  }

  if (input.playstyle !== "pvp" && input.playstyle !== "pvm") {
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
    createdAt: now,
  })

  // If this was marked main, sync users table
  if (isMain) {
    await db
      .update(users)
      .set({ gameNick: name, playstyle: input.playstyle })
      .where(eq(users.id, user.id))
  }

  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")

  return ok("Dodano postać.", {
    character: {
      id: charId,
      name,
      playstyle: input.playstyle,
      isMain,
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
  playstyle: "pvp" | "pvm"
}): Promise<ActionResult> {
  const user = await requireUser()
  const name = input.name.trim()

  if (!name || name.length < 2 || name.length > 24) {
    return fail("Nick postaci musi mieć od 2 do 24 znaków.")
  }

  if (input.playstyle !== "pvp" && input.playstyle !== "pvm") {
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
    .set({ name, playstyle: input.playstyle })
    .where(eq(userCharacters.id, input.characterId))

  // If this character is main, sync users table
  if (char.isMain) {
    await db
      .update(users)
      .set({ gameNick: name, playstyle: input.playstyle })
      .where(eq(users.id, user.id))
  }

  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")

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

  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")

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

  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")

  return ok(`Usunięto postać „${char.name}”.`)
}
