"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { getDb, isUniqueViolation } from "@/lib/db"
import { feePayments } from "@/lib/db/schema"
import { isDevLoginEnabled } from "@/lib/constants"
import { seedTwoWeeksFeeHistory } from "@/lib/dev-seed-fees"
import { isPaymentOfferAmount } from "@/lib/fees"
import { getFeeLedger } from "@/lib/queries"
import { requireLeader, requireUser } from "@/lib/session"

function revalidateFees() {
  revalidatePath("/", "layout")
  revalidatePath("/skladki")
  revalidatePath("/statystyki")
}

async function offerAmountFor(userId: string, amountKk: number): Promise<number | null> {
  const ledger = await getFeeLedger()
  const state = ledger.get(userId)
  if (!state || !isPaymentOfferAmount(state, amountKk)) return null
  return amountKk
}

export async function reportPayment(amountKk: number): Promise<ActionResult> {
  const user = await requireUser()
  const amount = await offerAmountFor(user.id, amountKk)
  if (amount == null) return fail("Wybierz jedną z propozycji spłaty.")

  const db = await getDb()
  try {
    await db.insert(feePayments).values({
      id: crypto.randomUUID(),
      userId: user.id,
      amountKk: amount,
      status: "pending",
      reportedBy: user.id,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("Masz już zgłoszoną wpłatę oczekującą na weryfikację.")
    }
    throw error
  }

  revalidateFees()
  return ok("Zgłoszono wpłatę. Czeka na admina.")
}

export async function confirmPayment(paymentId: string): Promise<ActionResult> {
  const leader = await requireLeader()
  const db = await getDb()
  const row = await db.query.feePayments.findFirst({
    where: eq(feePayments.id, paymentId),
  })
  if (!row) return fail("Nie znaleziono zgłoszenia.")
  if (row.status !== "pending") return fail("To zgłoszenie jest już rozpatrzone.")

  await db
    .update(feePayments)
    .set({
      status: "confirmed",
      confirmedBy: leader.id,
      resolvedAt: new Date(),
    })
    .where(and(eq(feePayments.id, paymentId), eq(feePayments.status, "pending")))

  revalidateFees()
  return ok("Wpłata potwierdzona.")
}

export async function rejectPayment(paymentId: string): Promise<ActionResult> {
  const leader = await requireLeader()
  const db = await getDb()
  const row = await db.query.feePayments.findFirst({
    where: eq(feePayments.id, paymentId),
  })
  if (!row) return fail("Nie znaleziono zgłoszenia.")
  if (row.status !== "pending") return fail("To zgłoszenie jest już rozpatrzone.")

  await db
    .update(feePayments)
    .set({
      status: "rejected",
      confirmedBy: leader.id,
      resolvedAt: new Date(),
    })
    .where(and(eq(feePayments.id, paymentId), eq(feePayments.status, "pending")))

  revalidateFees()
  return ok("Zgłoszenie odrzucone.")
}

export async function recordPayment(userId: string, amountKk: number): Promise<ActionResult> {
  const leader = await requireLeader()
  const amount = await offerAmountFor(userId, amountKk)
  if (amount == null) return fail("Wybierz jedną z propozycji spłaty.")

  const db = await getDb()
  await db.insert(feePayments).values({
    id: crypto.randomUUID(),
    userId,
    amountKk: amount,
    status: "confirmed",
    reportedBy: leader.id,
    confirmedBy: leader.id,
    resolvedAt: new Date(),
  })

  await db
    .update(feePayments)
    .set({
      status: "rejected",
      confirmedBy: leader.id,
      resolvedAt: new Date(),
    })
    .where(and(eq(feePayments.userId, userId), eq(feePayments.status, "pending")))

  revalidateFees()
  return ok("Odnotowano wpłatę.")
}

export async function seedDemoFeeHistory(): Promise<ActionResult> {
  if (!isDevLoginEnabled()) return fail("Seed tylko przy lokalnym DEV_LOGIN.")
  const leader = await requireLeader()
  const result = await seedTwoWeeksFeeHistory(leader.id)
  revalidateFees()
  revalidatePath("/")
  return ok(
    `Wgrano demo: ${result.people} osób, ${result.signups} nowych wejść z dwóch tygodni wstecz.`
  )
}
