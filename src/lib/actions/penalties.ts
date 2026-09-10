"use server"

import { revalidatePath } from "next/cache"
import { and, desc, eq, gt, isNull } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildEventAuditLogs, userPenalties, users } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { formatDatePl } from "@/lib/dates"

type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string }

function ok<T>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data }
}

function fail<T = never>(error: string): ActionResult<T> {
  return { ok: false, error }
}

export type ActivePenaltyInfo = {
  id: string
  cardLevel: number
  durationDays: number
  allowedAdvanceDays: number
  reason: string
  issuedAt: string
  expiresAt: string
  expiresAtPl: string
  adminNick: string
}

export type PenaltyHistoryItem = {
  id: string
  userId: string
  userNick: string
  adminId: string
  adminNick: string
  eventId: string | null
  reason: string
  cardLevel: number
  durationDays: number
  issuedAt: string
  expiresAt: string
  expiresAtPl: string
  isActive: boolean
  revokedAt: string | null
}

/**
 * Returns the currently active penalty for a specific user, if any.
 */
export async function getActivePenaltyForUser(userId: string): Promise<ActivePenaltyInfo | null> {
  try {
    const db = await getDb()
    const now = new Date()

    const [penalty] = await db
      .select({
        id: userPenalties.id,
        cardLevel: userPenalties.cardLevel,
        durationDays: userPenalties.durationDays,
        reason: userPenalties.reason,
        issuedAt: userPenalties.issuedAt,
        expiresAt: userPenalties.expiresAt,
        adminNick: users.gameNick,
      })
      .from(userPenalties)
      .innerJoin(users, eq(userPenalties.adminId, users.id))
      .where(
        and(
          eq(userPenalties.userId, userId),
          isNull(userPenalties.revokedAt),
          gt(userPenalties.expiresAt, now)
        )
      )
      .orderBy(desc(userPenalties.expiresAt))
      .limit(1)

    if (!penalty) return null

    const expiresIso = new Date(penalty.expiresAt).toISOString()
    const expiresDateStr = expiresIso.slice(0, 10)

    let allowedAdvanceDays = 1
    try {
      const { getPenaltyRules } = await import("@/lib/settings")
      const rules = await getPenaltyRules()
      if (penalty.cardLevel === 1) allowedAdvanceDays = rules.card1.advanceDays
      else if (penalty.cardLevel === 2) allowedAdvanceDays = rules.card2.advanceDays
      else allowedAdvanceDays = rules.card3.advanceDays
    } catch {}

    return {
      id: penalty.id,
      cardLevel: penalty.cardLevel,
      durationDays: penalty.durationDays,
      allowedAdvanceDays,
      reason: penalty.reason,
      issuedAt: new Date(penalty.issuedAt).toISOString(),
      expiresAt: expiresIso,
      expiresAtPl: formatDatePl(expiresDateStr),
      adminNick: penalty.adminNick,
    }
  } catch (error) {
    console.warn("[penalties] getActivePenaltyForUser error:", error)
    return null
  }
}

/**
 * Admin action: Issue a yellow card to a user.
 * Duration and advance restrictions are loaded from configured penalty rules.
 */
export async function giveYellowCard(input: {
  userId: string
  reason: string
  eventId?: string
}): Promise<ActionResult<{ penaltyId: string; cardLevel: number; durationDays: number }>> {
  const admin = await requireUser()
  if (!admin.isLeader) {
    return fail("Tylko administrator może nadawać żółte kartki.")
  }

  const reason = input.reason.trim()
  if (!reason) {
    return fail("Wymagane jest podanie powodu nadania żółtej kartki.")
  }

  const db = await getDb()
  const now = new Date()

  // Check target user
  const [targetUser] = await db
    .select({ id: users.id, gameNick: users.gameNick })
    .from(users)
    .where(eq(users.id, input.userId))

  if (!targetUser) {
    return fail("Nie znaleziono użytkownika.")
  }

  // Find existing active penalties for this user to calculate level
  const activePenalties = await db
    .select({ id: userPenalties.id, cardLevel: userPenalties.cardLevel })
    .from(userPenalties)
    .where(
      and(
        eq(userPenalties.userId, input.userId),
        isNull(userPenalties.revokedAt),
        gt(userPenalties.expiresAt, now)
      )
    )

  const { getPenaltyRules } = await import("@/lib/settings")
  const penaltyRules = await getPenaltyRules()

  let cardLevel = 1
  let durationDays = penaltyRules.card1.durationDays

  if (activePenalties.length === 0) {
    cardLevel = 1
    durationDays = penaltyRules.card1.durationDays
  } else if (activePenalties.length === 1) {
    cardLevel = 2
    durationDays = penaltyRules.card2.durationDays
  } else {
    cardLevel = 3
    durationDays = penaltyRules.card3.durationDays
  }

  const penaltyId = crypto.randomUUID()
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

  await db.insert(userPenalties).values({
    id: penaltyId,
    userId: input.userId,
    adminId: admin.id,
    eventId: input.eventId || null,
    reason,
    cardLevel,
    durationDays,
    issuedAt: now,
    expiresAt,
  })

  // If associated with an event, log in event audit
  if (input.eventId) {
    try {
      await db.insert(guildEventAuditLogs).values({
        id: crypto.randomUUID(),
        eventId: input.eventId,
        action: "yellow_card",
        actorId: admin.id,
        targetUserId: input.userId,
        spot: null,
        role: null,
        reason,
        details: JSON.stringify({
          cardLevel,
          durationDays,
          expiresAt: expiresAt.toISOString(),
        }),
      })
    } catch (err) {
      console.error("Failed to write audit log in giveYellowCard:", err)
    }
  }

  revalidatePath("/admin")
  revalidatePath("/kalendarz")
  if (input.eventId) {
    revalidatePath(`/kalendarz/wydarzenie/${input.eventId}`)
  }
  revalidatePath("/panel")
  return ok(
    `Nadano żółtą kartkę (poziom ${cardLevel}, kara: ${durationDays} dni) graczowi ${targetUser.gameNick}.`,
    { penaltyId, cardLevel, durationDays }
  )
}

/**
 * Admin action: Update the explanation/reason of an existing yellow card.
 */
export async function updateYellowCardReason(input: {
  penaltyId: string
  reason: string
}): Promise<ActionResult> {
  const admin = await requireUser()
  if (!admin.isLeader) {
    return fail("Tylko administrator może edytować powód żółtej kartki.")
  }

  const reason = input.reason.trim()
  if (!reason) {
    return fail("Powód nie może być pusty.")
  }

  const db = await getDb()
  const [penalty] = await db
    .select({ id: userPenalties.id, eventId: userPenalties.eventId })
    .from(userPenalties)
    .where(eq(userPenalties.id, input.penaltyId))

  if (!penalty) {
    return fail("Nie znaleziono kary.")
  }

  await db
    .update(userPenalties)
    .set({ reason })
    .where(eq(userPenalties.id, input.penaltyId))

  revalidatePath("/admin")
  revalidatePath("/kalendarz")
  if (penalty.eventId) {
    revalidatePath(`/kalendarz/wydarzenie/${penalty.eventId}`)
  }
  return ok("Zaktualizowano powód kary.")
}

/**
 * Admin action: Revoke/cancel an active yellow card.
 */
export async function revokeYellowCard(input: {
  penaltyId: string
  reason?: string
}): Promise<ActionResult> {
  const admin = await requireUser()
  if (!admin.isLeader) {
    return fail("Tylko administrator może cofnąć żółtą kartkę.")
  }

  const db = await getDb()
  const [penalty] = await db
    .select({ id: userPenalties.id, eventId: userPenalties.eventId })
    .from(userPenalties)
    .where(eq(userPenalties.id, input.penaltyId))

  if (!penalty) {
    return fail("Nie znaleziono kary.")
  }

  await db
    .update(userPenalties)
    .set({
      revokedAt: new Date(),
      revokedBy: admin.id,
    })
    .where(eq(userPenalties.id, input.penaltyId))

  revalidatePath("/admin")
  revalidatePath("/kalendarz")
  if (penalty.eventId) {
    revalidatePath(`/kalendarz/wydarzenie/${penalty.eventId}`)
  }
  revalidatePath("/panel")
  return ok("Zdjęto żółtą kartkę.")
}

/**
 * List all penalties (for Admin panel).
 */
export async function listAllPenalties(): Promise<PenaltyHistoryItem[]> {
  try {
    const db = await getDb()
    const now = new Date()

    const rows = await db
      .select({
        id: userPenalties.id,
        userId: userPenalties.userId,
        userNick: users.gameNick,
        adminId: userPenalties.adminId,
        eventId: userPenalties.eventId,
        reason: userPenalties.reason,
        cardLevel: userPenalties.cardLevel,
        durationDays: userPenalties.durationDays,
        issuedAt: userPenalties.issuedAt,
        expiresAt: userPenalties.expiresAt,
        revokedAt: userPenalties.revokedAt,
      })
      .from(userPenalties)
      .innerJoin(users, eq(userPenalties.userId, users.id))
      .orderBy(desc(userPenalties.issuedAt))

    // Fetch admin nicks
    const adminIds = Array.from(new Set(rows.map((r) => r.adminId)))
    const adminUsers =
      adminIds.length > 0
        ? await db
            .select({ id: users.id, gameNick: users.gameNick })
            .from(users)
        : []
    const adminNickMap = new Map(adminUsers.map((u) => [u.id, u.gameNick]))

    return rows.map((r) => {
      const isRevoked = Boolean(r.revokedAt)
      const isExpired = new Date(r.expiresAt).getTime() <= now.getTime()
      const isActive = !isRevoked && !isExpired
      const expiresIso = new Date(r.expiresAt).toISOString()
      const expiresDateStr = expiresIso.slice(0, 10)

      return {
        id: r.id,
        userId: r.userId,
        userNick: r.userNick,
        adminId: r.adminId,
        adminNick: adminNickMap.get(r.adminId) ?? "Admin",
        eventId: r.eventId,
        reason: r.reason,
        cardLevel: r.cardLevel,
        durationDays: r.durationDays,
        issuedAt: new Date(r.issuedAt).toISOString(),
        expiresAt: expiresIso,
        expiresAtPl: formatDatePl(expiresDateStr),
        isActive,
        revokedAt: r.revokedAt ? new Date(r.revokedAt).toISOString() : null,
      }
    })
  } catch (error) {
    console.warn("[penalties] listAllPenalties error:", error)
    return []
  }
}
