"use server"

import { revalidatePath } from "next/cache"
import { and, eq, gte, ilike, inArray, isNull, or } from "drizzle-orm"
import { isPlaystyle } from "@/lib/constants"
import { getDb, isUniqueViolation } from "@/lib/db"
import { guildEvents, guildEventSignups, guildSettings, konwojGroupMembers, userCharacters, users } from "@/lib/db/schema"
import { todayInWarsaw } from "@/lib/dates"
import { createPasswordUser, findUserById } from "@/lib/db/users"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { hashPassword, parseLogin, parsePassword } from "@/lib/password"
import { requireLeader } from "@/lib/session"
import {
  SETTING_KEY_FEE_SETTLEMENT_DAYS,
  SETTING_KEY_SIGNUP_ADVANCE_DAYS,
  SETTING_KEY_SIGNUP_OPEN_TIME,
  SETTING_KEY_PENALTY_RULES,
  type PenaltyRulesConfig,
} from "@/lib/settings"

export async function setPlaystyle(userId: string, playstyle: string): Promise<ActionResult> {
  await requireLeader()
  if (!isPlaystyle(playstyle)) return fail("Wybierz PVP albo PVM.")
  const db = await getDb()
  await db.update(users).set({ playstyle }).where(eq(users.id, userId))

  await db
    .update(userCharacters)
    .set({ playstyle: playstyle as "pvp" | "pvm" })
    .where(and(eq(userCharacters.userId, userId), eq(userCharacters.isMain, true)))

  await db
    .update(guildEventSignups)
    .set({
      role: playstyle === "pvp" ? "PvP" : "PvM",
    })
    .where(
      and(
        eq(guildEventSignups.userId, userId),
        or(
          isNull(guildEventSignups.role),
          ilike(guildEventSignups.role, "pvp"),
          ilike(guildEventSignups.role, "pvm")
        )
      )
    )

  revalidatePath("/", "layout")
  revalidatePath("/admin")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
  return ok()
}

export async function createUser(input: {
  gameNick: string
  login: string
  password: string
  playstyle: string
}): Promise<ActionResult> {
  await requireLeader()
  const gameNick = input.gameNick.trim()
  if (gameNick.length < 2 || gameNick.length > 24) {
    return fail("Nick w grze musi mieć 2–24 znaki.")
  }
  if (!parseLogin(input.login)) {
    return fail("Login: 3–24 znaki, litery, cyfry, kropka, _ lub -.")
  }
  if (!parsePassword(input.password)) {
    return fail("Hasło musi mieć 8–72 znaki.")
  }
  const playstyle = isPlaystyle(input.playstyle) ? input.playstyle : null
  if (!playstyle) return fail("Wybierz PVP albo PVM.")

  try {
    await createPasswordUser({
      gameNick,
      login: input.login,
      password: input.password,
      playstyle,
      isLeader: false, // admin is granted afterwards by the super admin, together with a guild
    })
  } catch (error) {
    if (error instanceof Error && (error.message === "LOGIN" || error.message === "PASSWORD")) {
      return fail("Nieprawidłowy login albo hasło.")
    }
    if (isUniqueViolation(error)) return fail("Ten login jest już zajęty.")
    throw error
  }

  revalidatePath("/admin")
  return ok("Konto utworzone.")
}

export async function setUserPassword(input: {
  userId: string
  login?: string
  password: string
}): Promise<ActionResult> {
  const actor = await requireLeader()
  const password = parsePassword(input.password)
  if (!password) return fail("Hasło musi mieć 8–72 znaki.")

  const db = await getDb()
  const target = await findUserById(input.userId)
  if (!target) return fail("Nie znaleziono gracza.")
  if (target.isSuperAdmin && !actor.isSuperAdmin) return fail("Hasło super admina zmienia tylko on sam.")

  const login = input.login
    ? parseLogin(input.login)
    : target.login
  if (!login) return fail("Login: 3–24 znaki, litery, cyfry, kropka, _ lub -.")

  try {
    await db
      .update(users)
      .set({
        login,
        passwordHash: await hashPassword(password),
      })
      .where(eq(users.id, input.userId))
  } catch (error) {
    if (isUniqueViolation(error)) return fail("Ten login jest już zajęty.")
    throw error
  }

  revalidatePath("/admin")
  return ok("Zapisano login i hasło.")
}

export async function setFeeSettlementDays(days: number): Promise<ActionResult> {
  const leader = await requireLeader()
  if (!Number.isInteger(days) || days < 0 || days > 14) {
    return fail("Liczba dni musi być liczbą całkowitą od 0 do 14.")
  }

  const db = await getDb()
  await db
    .insert(guildSettings)
    .values({
      key: SETTING_KEY_FEE_SETTLEMENT_DAYS,
      value: String(days),
      updatedAt: new Date(),
      updatedBy: leader.id,
    })
    .onConflictDoUpdate({
      target: guildSettings.key,
      set: {
        value: String(days),
        updatedAt: new Date(),
        updatedBy: leader.id,
      },
    })

  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  revalidatePath("/kalendarz")
  revalidatePath("/skladki")
  revalidatePath("/panel")
  return ok("Zapisano czas na uregulowanie składki.")
}

export async function setSignupAdvanceDays(days: number): Promise<ActionResult> {
  const leader = await requireLeader()
  if (!Number.isInteger(days) || days < 0 || days > 30) {
    return fail("Liczba dni wyprzedzenia musi być liczbą całkowitą od 0 do 30.")
  }

  const db = await getDb()
  await db
    .insert(guildSettings)
    .values({
      key: SETTING_KEY_SIGNUP_ADVANCE_DAYS,
      value: String(days),
      updatedAt: new Date(),
      updatedBy: leader.id,
    })
    .onConflictDoUpdate({
      target: guildSettings.key,
      set: {
        value: String(days),
        updatedAt: new Date(),
        updatedBy: leader.id,
      },
    })

  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  return ok(`Zapisano wyprzedzenie zapisów: ${days} ${days === 1 ? "dzień" : "dni"}.`)
}

export async function setSignupOpenTime(time: string): Promise<ActionResult> {
  const leader = await requireLeader()
  const trimmed = (time || "").trim()
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return fail("Godzina otwarcia zapisów musi być w formacie GG:MM (np. 09:00).")
  }
  const [h, m] = trimmed.split(":").map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return fail("Nieprawidłowa godzina. Podaj wartość między 00:00 a 23:59.")
  }

  const db = await getDb()
  await db
    .insert(guildSettings)
    .values({
      key: SETTING_KEY_SIGNUP_OPEN_TIME,
      value: trimmed,
      updatedAt: new Date(),
      updatedBy: leader.id,
    })
    .onConflictDoUpdate({
      target: guildSettings.key,
      set: {
        value: trimmed,
        updatedAt: new Date(),
        updatedBy: leader.id,
      },
    })

  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  return ok(`Zapisano godzinę otwarcia zapisów: ${trimmed}.`)
}

export async function setSignupAdvanceSettings({
  advanceDays,
  openTime,
}: {
  advanceDays: number
  openTime: string
}): Promise<ActionResult> {
  const leader = await requireLeader()
  if (!Number.isInteger(advanceDays) || advanceDays < 0 || advanceDays > 30) {
    return fail("Liczba dni wyprzedzenia musi być liczbą całkowitą od 0 do 30.")
  }
  const trimmedTime = (openTime || "").trim()
  if (!/^\d{2}:\d{2}$/.test(trimmedTime)) {
    return fail("Godzina otwarcia zapisów musi być w formacie GG:MM (np. 09:00).")
  }
  const [h, m] = trimmedTime.split(":").map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return fail("Nieprawidłowa godzina. Podaj wartość między 00:00 a 23:59.")
  }

  const db = await getDb()
  await Promise.all([
    db
      .insert(guildSettings)
      .values({
        key: SETTING_KEY_SIGNUP_ADVANCE_DAYS,
        value: String(advanceDays),
        updatedAt: new Date(),
        updatedBy: leader.id,
      })
      .onConflictDoUpdate({
        target: guildSettings.key,
        set: {
          value: String(advanceDays),
          updatedAt: new Date(),
          updatedBy: leader.id,
        },
      }),
    db
      .insert(guildSettings)
      .values({
        key: SETTING_KEY_SIGNUP_OPEN_TIME,
        value: trimmedTime,
        updatedAt: new Date(),
        updatedBy: leader.id,
      })
      .onConflictDoUpdate({
        target: guildSettings.key,
        set: {
          value: trimmedTime,
          updatedAt: new Date(),
          updatedBy: leader.id,
        },
      }),
  ])

  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  return ok(
    `Zapisano: wyprzedzenie ${advanceDays} ${advanceDays === 1 ? "dzień" : "dni"}, godzina otwarcia ${trimmedTime}.`
  )
}

export async function setPenaltyRules(rules: PenaltyRulesConfig): Promise<ActionResult> {
  const leader = await requireLeader()
  if (
    !rules ||
    typeof rules.card1?.durationDays !== "number" ||
    typeof rules.card2?.durationDays !== "number" ||
    typeof rules.card3?.durationDays !== "number"
  ) {
    return fail("Nieprawidłowa konfiguracja kar.")
  }

  const validated: PenaltyRulesConfig = {
    card1: {
      durationDays: Math.max(1, Math.min(365, Math.round(rules.card1.durationDays))),
      advanceDays: Math.max(0, Math.min(30, Math.round(rules.card1.advanceDays))),
    },
    card2: {
      durationDays: Math.max(1, Math.min(365, Math.round(rules.card2.durationDays))),
      advanceDays: Math.max(0, Math.min(30, Math.round(rules.card2.advanceDays))),
    },
    card3: {
      durationDays: Math.max(1, Math.min(365, Math.round(rules.card3.durationDays))),
      advanceDays: Math.max(0, Math.min(30, Math.round(rules.card3.advanceDays))),
    },
  }

  const db = await getDb()
  await db
    .insert(guildSettings)
    .values({
      key: SETTING_KEY_PENALTY_RULES,
      value: JSON.stringify(validated),
      updatedAt: new Date(),
      updatedBy: leader.id,
    })
    .onConflictDoUpdate({
      target: guildSettings.key,
      set: {
        value: JSON.stringify(validated),
        updatedAt: new Date(),
        updatedBy: leader.id,
      },
    })

  revalidatePath("/admin")
  revalidatePath("/admin/konfiguracja")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  return ok("Zapisano reguły żółtych kartek.")
}

export async function setUserVerified(userId: string, isVerified: boolean): Promise<ActionResult> {
  await requireLeader()
  const db = await getDb()
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  if (!target) return fail("Nie znaleziono użytkownika.")

  await db.update(users).set({ isVerified }).where(eq(users.id, userId))
  revalidatePath("/", "layout")
  revalidatePath("/admin")
  return ok(isVerified ? "Użytkownik został zweryfikowany." : "Cofnięto weryfikację użytkownika.")
}

/**
 * Soft-deletes an account: it can't log in and leaves every list, but its rows stay so history keeps the nick.
 * A hard delete would cascade away penalties, Konwój payouts and screenshots.
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const actor = await requireLeader()
  if (userId === actor.id) return fail("Nie możesz usunąć własnego konta.")
  const db = await getDb()
  const target = await db.query.users.findFirst({ where: and(eq(users.id, userId), isNull(users.deletedAt)) })
  if (!target) return fail("Nie znaleziono użytkownika.")
  if (target.isSuperAdmin) return fail("Nie można usunąć konta super admina.")

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        deletedAt: new Date(),
        discordId: null, // the same Discord account can register again as a fresh account
        login: null,
        passwordHash: null,
        isLeader: false,
        isVerified: false,
        roles: "[]",
      })
      .where(eq(users.id, userId))
    await tx.delete(konwojGroupMembers).where(eq(konwojGroupMembers.userId, userId))
    // Free spots in upcoming events; past signups stay as history.
    await tx
      .delete(guildEventSignups)
      .where(
        and(
          eq(guildEventSignups.userId, userId),
          inArray(
            guildEventSignups.eventId,
            tx.select({ id: guildEvents.id }).from(guildEvents).where(gte(guildEvents.date, todayInWarsaw()))
          )
        )
      )
  })

  revalidatePath("/", "layout")
  revalidatePath("/admin")
  return ok(`Usunięto konto ${target.gameNick}.`)
}

export async function setUserRoles(userId: string, roles: string[]): Promise<ActionResult> {
  await requireLeader()
  const db = await getDb()
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  if (!target) return fail("Nie znaleziono użytkownika.")

  const cleanRoles = Array.from(new Set(roles.map((r) => r.trim()).filter(Boolean)))
  await db
    .update(users)
    .set({ roles: JSON.stringify(cleanRoles) })
    .where(eq(users.id, userId))

  revalidatePath("/", "layout")
  revalidatePath("/admin")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  return ok("Zaktualizowano role użytkownika.")
}

export async function toggleUserRole(userId: string, role: string): Promise<ActionResult> {
  await requireLeader()
  const db = await getDb()
  const target = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  if (!target) return fail("Nie znaleziono użytkownika.")

  let currentRoles: string[] = []
  try {
    currentRoles = target.roles ? JSON.parse(target.roles) : []
  } catch {
    currentRoles = []
  }

  const roleClean = role.trim()
  const has = currentRoles.includes(roleClean)
  const nextRoles = has
    ? currentRoles.filter((r) => r !== roleClean)
    : [...currentRoles, roleClean]

  await db
    .update(users)
    .set({ roles: JSON.stringify(nextRoles) })
    .where(eq(users.id, userId))

  revalidatePath("/", "layout")
  revalidatePath("/admin")
  revalidatePath("/kalendarz")
  revalidatePath("/panel")
  return ok(has ? `Usunięto rolę ${roleClean}.` : `Nadano rolę ${roleClean}.`)
}


