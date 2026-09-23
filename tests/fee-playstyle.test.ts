import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/db"
import { guildEvents, guildEventSignups, userCharacters, users } from "@/lib/db/schema"
import { getFeeLedger } from "@/lib/queries"
import { PVM_FEE_KK, PVP_FEE_KK } from "@/lib/constants"
import { addDays, weekStartInWarsaw } from "@/lib/dates"
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
})
