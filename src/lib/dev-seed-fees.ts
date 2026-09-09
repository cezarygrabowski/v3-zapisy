import { and, eq, gte, lte } from "drizzle-orm"
import {
  feeForPlaystyle,
  POSITION_IDS,
  SLOT_IDS,
  type Playstyle,
  type PositionId,
  type SlotId,
} from "@/lib/constants"
import { V3_EVENT_SPOTS } from "@/lib/calendar-types"
import { addDays, todayInWarsaw, weekStartInWarsaw } from "@/lib/dates"
import { getDb } from "@/lib/db"
import { feePayments, guildEvents, guildEventSignups, signups, users } from "@/lib/db/schema"
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

  // 1. Ensure daily V3 calendar events exist for the past 2 weeks and current week
  const existingGuildEvents = await db
    .select({
      id: guildEvents.id,
      date: guildEvents.date,
      startTime: guildEvents.startTime,
      type: guildEvents.type,
    })
    .from(guildEvents)
    .where(and(gte(guildEvents.date, fromDate), lte(guildEvents.date, today), eq(guildEvents.type, "v3")))

  const eventMap = new Map<string, string>() // `${date}:${startTime}` -> eventId
  for (const ge of existingGuildEvents) {
    eventMap.set(`${ge.date}:${ge.startTime}`, ge.id)
  }

  // Define two V3 slots per day (morning 11:30 and evening 18:00)
  const dailySlots = [
    { title: "V3 11:30-14:30", startTime: "11:30", endTime: "14:30", color: "blue" },
    { title: "V3 18:00-21:00", startTime: "18:00", endTime: "21:00", color: "brown" },
  ]

  // Create events for any missing days/slots
  let currDate = fromDate
  while (currDate <= today) {
    for (const slotDef of dailySlots) {
      const key = `${currDate}:${slotDef.startTime}`
      if (!eventMap.has(key)) {
        const newEventId = crypto.randomUUID()
        await db.insert(guildEvents).values({
          id: newEventId,
          title: slotDef.title,
          type: "v3",
          date: currDate,
          startTime: slotDef.startTime,
          endTime: slotDef.endTime,
          durationHours: 3,
          color: slotDef.color,
          status: "finished",
          signupMode: "spots",
          recurrence: "none",
          createdBy: leaderId,
        })
        eventMap.set(key, newEventId)
      }
    }
    currDate = addDays(currDate, 1)
  }

  // 2. Fetch existing signups in both guildEventSignups and legacy signups
  const existingGuildSignups = await db
    .select({
      eventId: guildEventSignups.eventId,
      userId: guildEventSignups.userId,
      spot: guildEventSignups.spot,
    })
    .from(guildEventSignups)

  const takenGuildSpots = new Set(existingGuildSignups.map((s) => `${s.eventId}:${s.spot}`))
  const userInGuildEvent = new Set(existingGuildSignups.map((s) => `${s.eventId}:${s.userId}`))

  const existingLegacy = await db
    .select({
      date: signups.date,
      slot: signups.slot,
      position: signups.position,
      userId: signups.userId,
    })
    .from(signups)
    .where(and(gte(signups.date, fromDate), lte(signups.date, today)))

  const takenCell = new Set(existingLegacy.map((row) => `${row.date}:${row.slot}:${row.position}`))
  const takenDay = new Set(existingLegacy.map((row) => `${row.date}:${row.userId}`))
  const freeLegacy = cells()
  let inserted = 0

  const availableSpots = V3_EVENT_SPOTS.map((s) => s.id)

  for (const member of CAST) {
    const person = people.find((item) => item.nick === member.nick)
    if (!person) continue
    for (const weekOffset of member.weekOffsets) {
      const weekStart = addDays(currentWeek, weekOffset * 7)
      for (const weekday of member.weekdays) {
        const date = addDays(weekStart, weekday)
        if (date > today) continue

        // Pick an event on that date (prefer 11:30, fallback to 18:00)
        let targetEventId = eventMap.get(`${date}:11:30`)
        if (targetEventId && userInGuildEvent.has(`${targetEventId}:${person.id}`)) {
          targetEventId = eventMap.get(`${date}:18:00`)
        }
        if (!targetEventId) continue
        if (userInGuildEvent.has(`${targetEventId}:${person.id}`)) continue

        // Find free spot in this event
        const freeSpot = availableSpots.find((sp) => !takenGuildSpots.has(`${targetEventId}:${sp}`))
        if (!freeSpot) continue

        // Insert into guildEventSignups (what getFeeLedger actually uses!)
        await db.insert(guildEventSignups).values({
          id: crypto.randomUUID(),
          eventId: targetEventId,
          userId: person.id,
          hourIndex: 0,
          spot: freeSpot,
          role: person.playstyle === "pvp" ? "PvP" : "PvM",
          attended: true,
        })
        takenGuildSpots.add(`${targetEventId}:${freeSpot}`)
        userInGuildEvent.add(`${targetEventId}:${person.id}`)

        // Also insert into legacy signups table for backward compatibility
        if (!takenDay.has(`${date}:${person.id}`)) {
          const cell = freeLegacy.find((item) => !takenCell.has(`${date}:${item.slot}:${item.position}`))
          if (cell) {
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
          }
        }

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
