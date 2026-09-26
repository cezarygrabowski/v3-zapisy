import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/db"
import { guildEvents, guildEventSignups, userCharacters, users } from "@/lib/db/schema"
import { getFeeLedger } from "@/lib/queries"
import { PVM_FEE_KK, PVP_FEE_KK } from "@/lib/constants"
import { addDays, todayInWarsaw, weekStartInWarsaw } from "@/lib/dates"
import { eq } from "drizzle-orm"

describe("Fee calculation recalculates for previous week on character playstyle change", () => {
  const ts = Date.now()
  const userId = `test-user-fee-${ts}`
  const charId = `test-char-fee-${ts}`
  const charName = `FeeChar_${ts}`
  const eventId = `test-event-fee-${ts}`

  // A date from 2 weeks ago (definitely previous week)
  const previousWeekDate = addDays(weekStartInWarsaw(new Date()), -7)

  test.before(async () => {
    const db = await getDb()

    // Create user
    await db.insert(users).values({
      id: userId,
      discordName: `fee_tester_${ts}`,
      gameNick: `FeeTester_${ts}`,
      playstyle: "pvm",
      isVerified: true,
    })

    // Create character (PVM initially)
    await db.insert(userCharacters).values({
      id: charId,
      userId,
      name: charName,
      playstyle: "pvm",
      isMain: true,
    })

    // Create past event in previous week
    await db.insert(guildEvents).values({
      id: eventId,
      title: "V3 Expedition",
      type: "v3",
      date: previousWeekDate,
      startTime: "20:00",
      endTime: "21:00",
      createdBy: userId,
      status: "finished",
    })

    // Create attended signup with initial role "PvM"
    await db.insert(guildEventSignups).values({
      id: `signup-${ts}`,
      eventId,
      userId,
      characterId: charId,
      characterName: charName,
      spot: "R1",
      role: "PvM",
      attended: true,
    })
  })

  test("calculates previous week fee as PVM (7 kk) initially", async () => {
    const ledger = await getFeeLedger()
    const state = ledger.get(userId)
    assert.ok(state, "User fee state should exist")
    assert.equal(state.overdueKk, PVM_FEE_KK)
    assert.equal(state.overdueWeeks.length, 1)
    assert.equal(state.overdueWeeks[0].chargedKk, PVM_FEE_KK)
    assert.equal(state.previousWeek.remainingKk, PVM_FEE_KK)
    assert.equal(state.previousWeek.entries.length, 1)
  })

  test("recalculates previous week fee as PVP (3 kk) when character playstyle changes to pvp", async () => {
    const db = await getDb()

    // Simulate updating character to pvp
    await db
      .update(userCharacters)
      .set({ playstyle: "pvp" })
      .where(eq(userCharacters.id, charId))

    await db
      .update(users)
      .set({ playstyle: "pvp" })
      .where(eq(users.id, userId))

    const ledger = await getFeeLedger()
    const state = ledger.get(userId)
    assert.ok(state, "User fee state should exist")
    assert.equal(
      state.overdueKk,
      PVP_FEE_KK,
      "Fee should be recalculated to 3 kk for the previous week"
    )
    assert.equal(state.overdueWeeks[0].chargedKk, PVP_FEE_KK)
    assert.equal(state.previousWeek.remainingKk, PVP_FEE_KK)
  })

  test("recalculates back to PVM (7 kk) when character playstyle changes back to pvm", async () => {
    const db = await getDb()

    await db
      .update(userCharacters)
      .set({ playstyle: "pvm" })
      .where(eq(userCharacters.id, charId))

    await db
      .update(users)
      .set({ playstyle: "pvm" })
      .where(eq(users.id, userId))

    const ledger = await getFeeLedger()
    const state = ledger.get(userId)
    assert.ok(state, "User fee state should exist")
    assert.equal(
      state.overdueKk,
      PVM_FEE_KK,
      "Fee should be recalculated back to 7 kk for the previous week"
    )
    assert.equal(state.overdueWeeks[0].chargedKk, PVM_FEE_KK)
  })

  test("handles legacy signups without characterId by using user playstyle", async () => {
    const db = await getDb()
    const legacyEventId = `test-legacy-event-${Date.now()}`

    // Insert legacy signup with null characterId and old frozen role "PvM"
    await db.insert(guildEvents).values({
      id: legacyEventId,
      title: "V3 Legacy",
      type: "v3",
      date: previousWeekDate,
      startTime: "21:00",
      endTime: "22:00",
      createdBy: userId,
      status: "finished",
    })

    await db.insert(guildEventSignups).values({
      id: `legacy-signup-${Date.now()}`,
      eventId: legacyEventId,
      userId,
      characterId: null,
      spot: "R2",
      role: "PvM",
      attended: true,
    })

    // When user playstyle is pvp
    await db
      .update(users)
      .set({ playstyle: "pvp" })
      .where(eq(users.id, userId))

    // Also update charId to pvp so both are pvp
    await db
      .update(userCharacters)
      .set({ playstyle: "pvp" })
      .where(eq(userCharacters.id, charId))

    const ledger = await getFeeLedger()
    const state = ledger.get(userId)
    assert.ok(state, "User fee state should exist")
    // 2 events * 3 kk = 6 kk
    assert.equal(state.overdueKk, 2 * PVP_FEE_KK)
  })

  test("uses user profile playstyle (users.playstyle) even if signup was marked PvM and character was PvM", async () => {
    const db = await getDb()
    const altCharId = `alt-char-${Date.now()}`
    const altEventId = `alt-event-${Date.now()}`

    // Insert an alt character that is pvm
    await db.insert(userCharacters).values({
      id: altCharId,
      userId,
      name: `AltChar_${Date.now()}`,
      playstyle: "pvm",
      isMain: false,
    })

    // Insert an event where signup role was PvM and character was pvm
    await db.insert(guildEvents).values({
      id: altEventId,
      title: "V3 Friday",
      type: "v3",
      date: previousWeekDate,
      startTime: "08:30",
      endTime: "11:30",
      createdBy: userId,
      status: "finished",
    })

    await db.insert(guildEventSignups).values({
      id: `alt-signup-${Date.now()}`,
      eventId: altEventId,
      userId,
      characterId: altCharId,
      spot: "PRAWO",
      role: "PvM",
      attended: true,
    })

    // Profile playstyle is PVP
    await db.update(users).set({ playstyle: "pvp" }).where(eq(users.id, userId))

    const ledger = await getFeeLedger()
    const state = ledger.get(userId)
    assert.ok(state, "User fee state should exist")

    // The Friday event entry must be charged at 3 kk (PVP_FEE_KK), NOT 7 kk!
    const week = state.overdueWeeks.find((w) => w.weekStart === previousWeekDate)
    assert.ok(week, "Previous week should be found")
    const fridayEntry = week.entries.find((e) => e.date === previousWeekDate && e.position === "PRAWO")
    assert.ok(fridayEntry, "Friday entry should be found")
    assert.equal(fridayEntry.feeKk, PVP_FEE_KK, "Friday entry should be 3 kk because user profile is PVP")
  })

  test("toDateKk includes current week entries while overdueKk only counts closed weeks", async () => {
    const db = await getDb()
    const currentWeekEventId = `cur-event-${Date.now()}`
    const today = todayInWarsaw(new Date())

    await db.insert(guildEvents).values({
      id: currentWeekEventId,
      title: "Current Week V3",
      type: "v3",
      date: today,
      startTime: "14:30",
      endTime: "17:30",
      createdBy: userId,
      status: "finished",
    })

    await db.insert(guildEventSignups).values({
      id: `cur-signup-${Date.now()}`,
      eventId: currentWeekEventId,
      userId,
      characterId: charId,
      spot: "R2",
      role: "PvP",
      attended: true,
    })

    const ledger = await getFeeLedger()
    const state = ledger.get(userId)
    assert.ok(state, "User fee state should exist")

    // The user had 3 events in previous week (3 * 3 kk = 9 kk)
    assert.equal(state.overdueKk, 3 * PVP_FEE_KK, "overdueKk should NOT include current week")
    // toDateKk must include previous week (9 kk) + current week (3 kk) = 12 kk
    assert.equal(state.toDateKk, 4 * PVP_FEE_KK, "toDateKk MUST include current week entries")
    assert.equal(state.currentWeekRemainingKk, PVP_FEE_KK)
    assert.ok(state.toDateWeeks.some((w) => w.weekStart === weekStartInWarsaw(new Date())))
  })
})
