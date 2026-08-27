"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { isPlaystyle } from "@/lib/constants"
import { getDb, isUniqueViolation } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { hashPassword, parseLogin, parsePassword } from "@/lib/password"
import { requireUser } from "@/lib/session"

export async function updateProfile(input: {
  gameNick: string
  playstyle: string
}): Promise<ActionResult> {
  const user = await requireUser()
  const gameNick = input.gameNick.trim()
  if (gameNick.length < 2 || gameNick.length > 24) {
    return fail("Nick w grze musi mieć 2–24 znaki.")
  }
  if (!isPlaystyle(input.playstyle)) {
    return fail("Wybierz PVP albo PVM.")
  }

  const db = await getDb()
  await db
    .update(users)
    .set({ gameNick, playstyle: input.playstyle })
    .where(eq(users.id, user.id))

  revalidatePath("/", "layout")
  revalidatePath("/konto")
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
