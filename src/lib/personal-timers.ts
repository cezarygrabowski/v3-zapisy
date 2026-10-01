import { and, eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { personalTimers, userCharacters } from "@/lib/db/schema"
import { fail, ok } from "@/lib/actions/result"
import type { AlertTimer, AlertTimerInput } from "@/lib/alert-timer-types"

// Identity is supplied only by the authenticated server action, never by the client.
export async function listPersonalTimers(userId: string): Promise<AlertTimer[]> {
  const db = await getDb()
  const rows = await db.select({
    id: personalTimers.id,
    name: personalTimers.name,
    characterId: personalTimers.characterId,
    characterName: userCharacters.name,
    intervalMinutes: personalTimers.intervalMinutes,
    lastCompletedAt: personalTimers.lastCompletedAt,
    createdAt: personalTimers.createdAt,
  }).from(personalTimers)
    .leftJoin(userCharacters, eq(personalTimers.characterId, userCharacters.id))
    .where(eq(personalTimers.userId, userId))

  return rows.map(({ createdAt, lastCompletedAt, ...row }) => ({
    ...row,
    lastCompletedAt: lastCompletedAt?.toISOString() ?? null,
    readyAt: lastCompletedAt
      ? lastCompletedAt.getTime() + row.intervalMinutes * 60000
      : createdAt.getTime(),
  }))
}

export async function savePersonalTimer(userId: string, input: AlertTimerInput) {
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) {
    return fail("Nazwa timera musi mieć od 1 do 80 znaków.")
  }
  if (!Number.isInteger(input.intervalMinutes) || input.intervalMinutes < 1 || input.intervalMinutes > 525600) {
    return fail("Czas oczekiwania musi wynosić od 1 do 525600 minut.")
  }
  if ((input.id !== undefined && (typeof input.id !== "string" || !input.id)) ||
      (input.characterId !== null && typeof input.characterId !== "string") ||
      (input.startNow !== undefined && typeof input.startNow !== "boolean")) {
    return fail("Nieprawidłowe dane timera.")
  }
  const db = await getDb()
  if (input.characterId !== null) {
    const [character] = await db.select({ id: userCharacters.id }).from(userCharacters)
      .where(and(eq(userCharacters.id, input.characterId), eq(userCharacters.userId, userId)))
    if (!character) return fail("Wybierz własną postać.")
  }
  const values = {
    name: input.name.trim(),
    characterId: input.characterId,
    intervalMinutes: input.intervalMinutes,
  }
  if (input.id) {
    const updated = await db.update(personalTimers).set(values)
      .where(and(eq(personalTimers.id, input.id), eq(personalTimers.userId, userId)))
      .returning({ id: personalTimers.id })
    if (!updated.length) return fail("Nie znaleziono timera.")
  } else {
    await db.insert(personalTimers).values({
      ...values, id: crypto.randomUUID(), userId,
      lastCompletedAt: input.startNow ? new Date() : null,
    })
  }
  return ok("Zapisano timer.")
}

export async function completePersonalTimer(userId: string, timerId: string) {
  if (typeof timerId !== "string" || !timerId) return fail("Nieprawidłowy timer.")
  const db = await getDb()
  const updated = await db.update(personalTimers).set({ lastCompletedAt: new Date() })
    .where(and(eq(personalTimers.id, timerId), eq(personalTimers.userId, userId)))
    .returning({ id: personalTimers.id })
  return updated.length ? ok("Rozpoczęto kolejne odliczanie.") : fail("Nie znaleziono timera.")
}

export async function removePersonalTimer(userId: string, timerId: string) {
  if (typeof timerId !== "string" || !timerId) return fail("Nieprawidłowy timer.")
  const db = await getDb()
  const deleted = await db.delete(personalTimers)
    .where(and(eq(personalTimers.id, timerId), eq(personalTimers.userId, userId)))
    .returning({ id: personalTimers.id })
  return deleted.length ? ok("Usunięto timer.") : fail("Nie znaleziono timera.")
}
