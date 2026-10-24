"use server"

import { revalidatePath } from "next/cache"
import { and, eq, ilike, isNull, or } from "drizzle-orm"
import { isPlaystyle } from "@/lib/constants"
import { getDb, isUniqueViolation } from "@/lib/db"
import { guildEventSignups, userCharacters, users } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { hashPassword, parseLogin, parsePassword } from "@/lib/password"
import { requireUser } from "@/lib/session"

export async function updateProfile(input: {
  gameNick: string
  playstyle: string | null
}): Promise<ActionResult> {
  const user = await requireUser()
  const gameNick = input.gameNick.trim()
  if (gameNick.length < 2 || gameNick.length > 24) {
    return fail("Nick w grze musi mieć 2–24 znaki.")
  }
  // null: the player does not go to V3.
  if (input.playstyle !== null && !isPlaystyle(input.playstyle)) {
    return fail("Wybierz PVP, PVM albo zostaw puste.")
  }

  const db = await getDb()
  await db
    .update(users)
    .set({ gameNick, playstyle: input.playstyle })
    .where(eq(users.id, user.id))

  await db
    .update(userCharacters)
    .set({
      name: gameNick,
      playstyle: input.playstyle,
    })
    .where(and(eq(userCharacters.userId, user.id), eq(userCharacters.isMain, true)))

  await db
    .update(guildEventSignups)
    // Without a V3 type the signups keep their role; only the name follows.
    .set({ characterName: gameNick, ...(input.playstyle && { role: input.playstyle === "pvp" ? "PvP" : "PvM" }) })
    .where(
      and(
        eq(guildEventSignups.userId, user.id),
        or(
          isNull(guildEventSignups.role),
          ilike(guildEventSignups.role, "pvp"),
          ilike(guildEventSignups.role, "pvm")
        )
      )
    )

  revalidatePath("/", "layout")
  revalidatePath("/konto")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok()
}

export async function setOwnPassword(input: {
  login?: string
  password: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const password = parsePassword(input.password)
  if (!password) return fail("Hasło musi mieć 8–72 znaki.")

  const login = user.login ?? (input.login ? parseLogin(input.login) : null)
  if (!login) return fail("Login: 3–24 znaki, litery, cyfry, kropka, _ lub -.")

  const db = await getDb()
  try {
    await db
      .update(users)
      .set({
        login,
        passwordHash: await hashPassword(password),
      })
      .where(eq(users.id, user.id))
  } catch (error) {
    if (isUniqueViolation(error)) return fail("Ten login jest już zajęty.")
    throw error
  }

  revalidatePath("/konto")
  return ok("Możesz logować się loginem i hasłem.")
}
