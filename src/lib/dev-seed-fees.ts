import { and, eq, gte, lte } from "drizzle-orm"
import {
  feeForPlaystyle,
  POSITION_IDS,
  SLOT_IDS,
  type Playstyle,
  type PositionId,
  type SlotId,
} from "@/lib/constants"
import { addDays, todayInWarsaw, weekStartInWarsaw } from "@/lib/dates"
import { getDb } from "@/lib/db"
import { feePayments, signups, users } from "@/lib/db/schema"
import { upsertDevUser } from "@/lib/db/users"
import { isPaymentOfferAmount } from "@/lib/fees"
import { getFeeLedger } from "@/lib/queries"

const CAST: { nick: string; playstyle: Playstyle; weekOffsets: number[]; weekdays: number[] }[] = [
  { nick: "Kuba", playstyle: "pvp", weekOffsets: [-2, -1, 0], weekdays: [0, 1, 2, 3, 4] },
  { nick: "Marek", playstyle: "pvp", weekOffsets: [-2, -1, 0], weekdays: [0, 2, 4] },
  { nick: "Nela", playstyle: "pvm", weekOffsets: [-2, -1], weekdays: [1, 2, 3] },
  { nick: "Tomek", playstyle: "pvp", weekOffsets: [-2, -1, 0], weekdays: [0, 1, 2, 3, 4, 5] },
  { nick: "Ola", playstyle: "pvm", weekOffsets: [-2, -1, 0], weekdays: [0, 2, 3, 5] },
  { nick: "Bartek", playstyle: "pvp", weekOffsets: [-1, 0], weekdays: [2, 4] },
  { nick: "Ala", playstyle: "pvm", weekOffsets: [-2, -1, 0], weekdays: [1, 3, 4] },
  { nick: "PastSlotTester", playstyle: "pvp", weekOffsets: [-2, -1, 0], weekdays: [0, 1, 2] },
  { nick: "Cezary", playstyle: "pvp", weekOffsets: [-2, -1, 0], weekdays: [0, 3] },
]

const SEED_PAYMENTS = {
  nelaOldest: "seed-pay-nela-oldest",
  tomekPending: "seed-pending-tomek",
  olaRejected: "seed-rej-ola",
} as const

function cells(): { slot: SlotId; position: PositionId }[] {
  return SLOT_IDS.flatMap((slot) => POSITION_IDS.map((position) => ({ slot, position })))
}

export async function seedTwoWeeksFeeHistory(leaderId: string): Promise<{
  signups: number
  people: number
}> {
  const db = await getDb()
  const today = todayInWarsaw()
  const currentWeek = weekStartInWarsaw()
  const fromDate = addDays(currentWeek, -14)

  const people: { id: string; nick: string; playstyle: Playstyle }[] = []
  for (const member of CAST) {
    const row = await upsertDevUser(member.nick, member.nick === "Cezary")
    await db.update(users).set({ playstyle: member.playstyle }).where(eq(users.id, row.id))
    people.push({ id: row.id, nick: member.nick, playstyle: member.playstyle })
  }

  const existing = await db
    .select({
      date: signups.date,
      slot: signups.slot,
      position: signups.position,
      userId: signups.userId,
    })
    .from(signups)
    .where(and(gte(signups.date, fromDate), lte(signups.date, today)))

  const takenCell = new Set(existing.map((row) => `${row.date}:${row.slot}:${row.position}`))
  const takenDay = new Set(existing.map((row) => `${row.date}:${row.userId}`))
  const free = cells()
  let inserted = 0

  for (const member of CAST) {
    const person = people.find((item) => item.nick === member.nick)
    if (!person) continue
    for (const weekOffset of member.weekOffsets) {
      const weekStart = addDays(currentWeek, weekOffset * 7)
      for (const weekday of member.weekdays) {
        const date = addDays(weekStart, weekday)
        if (date > today) continue
        if (takenDay.has(`${date}:${person.id}`)) continue
        const cell = free.find((item) => !takenCell.has(`${date}:${item.slot}:${item.position}`))
        if (!cell) continue
        await db.insert(signups).values({
          id: crypto.randomUUID(),
          date,
          slot: cell.slot,
          position: cell.position,
          userId: person.id,
          feeKk: feeForPlaystyle(person.playstyle),
          paid: false,
        })
        takenCell.add(`${date}:${cell.slot}:${cell.position}`)
        takenDay.add(`${date}:${person.id}`)
        inserted += 1
      }
    }
  }

  for (const id of Object.values(SEED_PAYMENTS)) {
    await db.delete(feePayments).where(eq(feePayments.id, id))
  }

  const ledger = await getFeeLedger()
  const byNick = new Map(people.map((person) => [person.nick, person.id]))

  async function confirmOffer(nick: string, paymentId: string, pick: "oldest" | "all") {
    const userId = byNick.get(nick)
    if (!userId) return
    const state = ledger.get(userId)
    if (!state || state.overdueKk <= 0) return
    const amountKk = pick === "all" ? state.overdueKk : state.overdueWeeks[0]?.remainingKk
    if (!amountKk || !isPaymentOfferAmount(state, amountKk)) return
    await db.insert(feePayments).values({
      id: paymentId,
      userId,
      amountKk,
      status: "confirmed",
      reportedBy: leaderId,
      confirmedBy: leaderId,
      resolvedAt: new Date(),
    })
  }

  async function pendingOffer(nick: string, paymentId: string) {
    const userId = byNick.get(nick)
    if (!userId) return
    const state = ledger.get(userId)
    const amountKk = state?.overdueWeeks[0]?.remainingKk
    if (!userId || !state || !amountKk || !isPaymentOfferAmount(state, amountKk)) return
    await db.delete(feePayments).where(and(eq(feePayments.userId, userId), eq(feePayments.status, "pending")))
    await db.insert(feePayments).values({
      id: paymentId,
      userId,
      amountKk,
      status: "pending",
      reportedBy: userId,
    })
  }

  await confirmOffer("Nela", SEED_PAYMENTS.nelaOldest, "oldest")
  await pendingOffer("Tomek", SEED_PAYMENTS.tomekPending)

  const olaId = byNick.get("Ola")
  const ola = olaId ? ledger.get(olaId) : null
  if (olaId && ola && ola.overdueWeeks[0]) {
    await db.insert(feePayments).values({
      id: SEED_PAYMENTS.olaRejected,
      userId: olaId,
      amountKk: ola.overdueWeeks[0].remainingKk,
      status: "rejected",
      reportedBy: olaId,
      confirmedBy: leaderId,
      resolvedAt: new Date(),
    })
  }

  return { signups: inserted, people: people.length }
}
