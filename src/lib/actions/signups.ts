"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import {
  feeForPlaystyle,
  isPlaystyle,
  isPositionId,
  isSlotId,
  type PositionId,
  type SlotId,
} from "@/lib/constants"
import { formatDatePl, getV3SignupOpenDate, isIsoDate, isV3SignupDateLocked, slotHasStarted } from "@/lib/dates"
import { getDb, isUniqueViolation } from "@/lib/db"
import { signups, users } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { requireLeader, requireUser } from "@/lib/session"
import { hasV3Access } from "@/lib/permissions"

function revalidateSignupPages() {
  revalidatePath("/", "layout")
  revalidatePath("/zapisy")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  revalidatePath("/run")
}

function parseCell(date: string, slot: string, position: string) {
  if (!isIsoDate(date)) return { error: "Nieprawidłowa data." as const }
  if (!isSlotId(slot)) return { error: "Nieprawidłowy slot." as const }
  if (!isPositionId(position)) return { error: "Nieprawidłowa pozycja." as const }
  return { date, slot, position }
}

export async function signUp(input: {
  date: string
  slot: string
  position: string
}): Promise<ActionResult> {
  const user = await requireUser()
  if (!hasV3Access(user)) {
    return fail("Tylko zweryfikowani członkowie z przypisaną rolą V3 mogą zapisywać się na V3.")
  }

  const parsed = parseCell(input.date, input.slot, input.position)
  if ("error" in parsed && parsed.error) return fail(parsed.error)

  const { date, slot, position } = parsed as {
    date: string
    slot: SlotId
    position: PositionId
  }

  if (isV3SignupDateLocked(date)) {
    return fail(
      `Zapisy na ten event V3 ruszają na 2 dni przed wydarzeniem (od ${formatDatePl(getV3SignupOpenDate(date))}).`
    )
  }

  const { checkUserFeeLock } = await import("@/lib/settings")
  const feeLock = await checkUserFeeLock(user.id)
  if (feeLock.isLocked) {
    return fail(
      feeLock.reason ??
        `Nie możesz zapisać się na V3: masz nieuregulowaną składkę za poprzedni tydzień (${feeLock.overdueKk} kk). Ureguluj ją w zakładce Składki.`
    )
  }

  if (!isPlaystyle(user.playstyle ?? "")) {
    return fail("Najpierw ustaw PVP albo PVM w koncie.", "NEED_PLAYSTYLE")
  }

  const db = await getDb()

  try {
    await db.insert(signups).values({
      id: crypto.randomUUID(),
      date,
      slot,
      position,
      userId: user.id,
      feeKk: feeForPlaystyle(user.playstyle as "pvp" | "pvm"),
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const own = await db.query.signups.findFirst({
        where: and(eq(signups.date, date), eq(signups.userId, user.id)),
      })
      if (own) {
        return fail("Jesteś już zapisany tego dnia. Najpierw wypisz się z poprzedniego miejsca.")
      }
      return fail("To miejsce właśnie zostało zajęte.")
    }
    throw error
  }

  revalidateSignupPages()
  return ok()
}

export async function signOutOfSlot(signupId: string): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()
  const row = await db.query.signups.findFirst({
    where: eq(signups.id, signupId),
  })
  if (!row) return fail("Nie znaleziono zapisu.")

  const isOwner = row.userId === user.id
  if (!isOwner && !user.isLeader) {
    return fail("Możesz wypisać tylko siebie.")
  }
  if (isOwner && !user.isLeader && slotHasStarted(row.date, row.slot as SlotId)) {
    return fail("Slot już się zaczął — wypisać może tylko admin.")
  }

  await db.delete(signups).where(eq(signups.id, signupId))
  revalidateSignupPages()
  return ok()
}

export async function leaderAssign(input: {
  date: string
  slot: string
  position: string
  userId: string
}): Promise<ActionResult> {
  await requireLeader()
  const parsed = parseCell(input.date, input.slot, input.position)
  if ("error" in parsed && parsed.error) return fail(parsed.error)

  const { date, slot, position } = parsed as {
    date: string
    slot: SlotId
    position: PositionId
  }

  const db = await getDb()
  const target = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  })
  if (!target) return fail("Nie znaleziono gracza.")
  if (!isPlaystyle(target.playstyle ?? "")) {
    return fail("Ten gracz nie ma ustawionego PVP/PVM.")
  }

  const occupying = await db.query.signups.findFirst({
    where: and(
      eq(signups.date, date),
      eq(signups.slot, slot),
      eq(signups.position, position)
    ),
  })
  if (occupying && occupying.userId !== target.id) {
    await db.delete(signups).where(eq(signups.id, occupying.id))
  }

  const existingForUser = await db.query.signups.findFirst({
    where: and(eq(signups.date, date), eq(signups.userId, target.id)),
  })
  if (existingForUser && existingForUser.id !== occupying?.id) {
    await db.delete(signups).where(eq(signups.id, existingForUser.id))
  }

  const stillHere = await db.query.signups.findFirst({
    where: and(
      eq(signups.date, date),
      eq(signups.slot, slot),
      eq(signups.position, position),
      eq(signups.userId, target.id)
    ),
  })
  if (!stillHere) {
    try {
      await db.insert(signups).values({
        id: crypto.randomUUID(),
        date,
        slot,
        position,
        userId: target.id,
        feeKk: feeForPlaystyle(target.playstyle as "pvp" | "pvm"),
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return fail("Nie udało się wpisać — miejsce lub dzień zajęty.")
      }
      throw error
    }
  }

  revalidateSignupPages()
  return ok()
}

export async function leaderRemove(signupId: string): Promise<ActionResult> {
  await requireLeader()
  const db = await getDb()
  await db.delete(signups).where(eq(signups.id, signupId))
  revalidateSignupPages()
  return ok()
}


