import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { calculateV3EnemyRaidStatus } from "@/lib/actions/v3-enemy-report"
import { getDb } from "@/lib/db"
import { guildEvents, guildEventSignups, guildEventEnemyReports, users, userCharacters } from "@/lib/db/schema"
import { getFeeLedger } from "@/lib/queries"
import { PVM_FEE_KK } from "@/lib/constants"
import { addDays, weekStartInWarsaw } from "@/lib/dates"
import { eq } from "drizzle-orm"

describe("V3 Enemy Raid & Fee Waiver Business Rules", () => {
  describe("calculateV3EnemyRaidStatus unit logic", () => {
    const baseEvent = {
      date: "2026-09-26",
      startTime: "18:00",
      feeWaived: false,
      feeWaivedReason: null,
      type: "v3",
    }

    test("allows reporting throughout event and checks 2-hour fee waiver expiration", async () => {
      const participants = new Set(["u1", "u2", "u3", "u4", "u5", "u6", "u7"])

      // Before start (17:50)
      const beforeStart = new Date("2026-09-26T15:50:00Z") // 17:50 Warsaw (UTC+2)
      const statusBefore = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [],
        currentUserId: "u1",
        now: beforeStart,
      })
      assert.equal(statusBefore.windowStarted, false)
      assert.equal(statusBefore.windowExpired, false)
      assert.equal(statusBefore.canReport, false)

      // Active window (19:00 Warsaw, 1 hour in)
      const duringWindow = new Date("2026-09-26T17:00:00Z") // 19:00 Warsaw (UTC+2)
      const statusDuring = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [],
        currentUserId: "u1",
        now: duringWindow,
      })
      assert.equal(statusDuring.windowStarted, true)
      assert.equal(statusDuring.windowExpired, false)
      assert.equal(statusDuring.waiverWindowExpired, false)
      assert.equal(statusDuring.canReport, true)

      // Last hour (20:30 Warsaw, 2.5 hours in, event lasts 3h until 21:00)
      const lastHour = new Date("2026-09-26T18:30:00Z") // 20:30 Warsaw (UTC+2)
      const statusLastHour = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [],
        currentUserId: "u1",
        now: lastHour,
      })
      assert.equal(statusLastHour.windowStarted, true)
      assert.equal(statusLastHour.windowExpired, false) // Event still in progress!
      assert.equal(statusLastHour.waiverWindowExpired, true) // 2h waiver window passed!
      assert.equal(statusLastHour.canReport, true) // Can still report enemy!

      // After event end (21:10 Warsaw, >3h)
      const afterEnd = new Date("2026-09-26T19:10:00Z") // 21:10 Warsaw (UTC+2)
      const statusAfterEnd = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [],
        currentUserId: "u1",
        now: afterEnd,
      })
      assert.equal(statusAfterEnd.windowExpired, true)
      assert.equal(statusAfterEnd.canReport, false)
    })

    test("only registered participants can report", async () => {
      const participants = new Set(["u1", "u2"])
      const duringWindow = new Date("2026-09-26T17:00:00Z") // 19:00 Warsaw

      // User not in participants list
      const statusNonParticipant = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [],
        currentUserId: "outsider",
        now: duringWindow,
      })
      assert.equal(statusNonParticipant.canReport, false)

      // Participant
      const statusParticipant = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [],
        currentUserId: "u1",
        now: duringWindow,
      })
      assert.equal(statusParticipant.canReport, true)
    })

    test("evaluates threshold > 50% correctly", async () => {
      const participants = new Set(["u1", "u2", "u3", "u4", "u5", "u6", "u7"])
      const duringWindow = new Date("2026-09-26T17:00:00Z")
      const reportTime = new Date("2026-09-26T16:30:00Z") // 18:30 Warsaw

      // 3 out of 7 = 42.8% <= 50% -> NOT waived
      const status3 = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [
          { userId: "u1", createdAt: reportTime },
          { userId: "u2", createdAt: reportTime },
          { userId: "u3", createdAt: reportTime },
        ],
        currentUserId: "u1",
        now: duringWindow,
      })
      assert.equal(status3.reportsCount, 3)
      assert.equal(status3.totalParticipants, 7)
      assert.equal(status3.thresholdPassed, false)
      assert.equal(status3.isWaived, false)

      // 4 out of 7 = 57.1% > 50% -> WAIVED
      const status4 = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [
          { userId: "u1", createdAt: reportTime },
          { userId: "u2", createdAt: reportTime },
          { userId: "u3", createdAt: reportTime },
          { userId: "u4", createdAt: reportTime },
        ],
        currentUserId: "u1",
        now: duringWindow,
      })
      assert.equal(status4.reportsCount, 4)
      assert.equal(status4.thresholdPassed, true)
      assert.equal(status4.isWaived, true)
      assert.ok(status4.feeWaivedReason?.includes("Wróg na V3"))
    })

    test("ignores reports outside the 2-hour window or from non-participants", async () => {
      const participants = new Set(["u1", "u2", "u3", "u4"])
      const duringWindow = new Date("2026-09-26T17:00:00Z")

      const validReportTime = new Date("2026-09-26T16:30:00Z") // 18:30 Warsaw (valid)
      const lateReportTime = new Date("2026-09-26T19:00:00Z") // 21:00 Warsaw (after 2h)

      const status = await calculateV3EnemyRaidStatus({
        event: baseEvent,
        participantUserIds: participants,
        reports: [
          { userId: "u1", createdAt: validReportTime }, // valid
          { userId: "u2", createdAt: validReportTime }, // valid
          { userId: "u3", createdAt: lateReportTime }, // invalid: too late
          { userId: "non_participant", createdAt: validReportTime }, // invalid: not in participants
        ],
        currentUserId: "u1",
        now: duringWindow,
      })

      // Only u1 and u2 are qualified -> 2 out of 4 = 50% (not > 50%) -> thresholdPassed = false
      assert.equal(status.reportsCount, 2)
      assert.equal(status.totalReportsCount, 3)
      assert.equal(status.totalParticipants, 4)
      assert.equal(status.thresholdPassed, false)
      assert.equal(status.isWaived, false)
    })
  })

  describe("Integration with getFeeLedger when fee is waived", () => {
    const ts = Date.now()
    const userId = `enemy-test-user-${ts}`
    const charId = `enemy-test-char-${ts}`
    const eventIdWaived = `event-waived-${ts}`
    const eventIdNormal = `event-normal-${ts}`

    const previousWeekDate = addDays(weekStartInWarsaw(new Date()), -7)

    test.before(async () => {
      const db = await getDb()

      await db.insert(users).values({
        id: userId,
        discordName: `enemy_tester_${ts}`,
        gameNick: `EnemyTester_${ts}`,
        playstyle: "pvm",
        isVerified: true,
      })

      await db.insert(userCharacters).values({
        id: charId,
        userId,
        name: `CharEnemy_${ts}`,
        playstyle: "pvm",
        isMain: true,
      })

      // Normal event (fee charged)
      await db.insert(guildEvents).values({
        id: eventIdNormal,
        title: "Normal V3 Event",
        type: "v3",
        date: previousWeekDate,
        startTime: "11:30",
        endTime: "14:30",
        createdBy: userId,
        status: "finished",
        feeWaived: false,
      })

      await db.insert(guildEventSignups).values({
        id: `signup-normal-${ts}`,
        eventId: eventIdNormal,
        userId,
        characterId: charId,
        characterName: `CharEnemy_${ts}`,
        spot: "R1",
        role: "PvM",
        attended: true,
      })

      // Waived event (enemy raided, >50% reported)
      await db.insert(guildEvents).values({
        id: eventIdWaived,
        title: "Enemy Raided V3 Event",
        type: "v3",
        date: previousWeekDate,
        startTime: "17:30",
        endTime: "20:30",
        createdBy: userId,
        status: "finished",
        feeWaived: true,
        feeWaivedReason: "Wróg na V3 (ponad 50% zgłoszeń uczestników w ciągu 2h)",
      })

      await db.insert(guildEventSignups).values({
        id: `signup-waived-${ts}`,
        eventId: eventIdWaived,
        userId,
        characterId: charId,
        characterName: `CharEnemy_${ts}`,
        spot: "R2",
        role: "PvM",
        attended: true,
      })
    })

    test("charges 0 kk for waived slot and normal fee for non-waived slot", async () => {
      const ledger = await getFeeLedger()
      const state = ledger.get(userId)
      assert.ok(state, "User fee state should exist")

      // User attended 2 slots, but 1 was waived -> charged only for 1 slot (7 kk instead of 14 kk)
      assert.equal(state.overdueKk, PVM_FEE_KK)

      const week = state.overdueWeeks[0]
      assert.ok(week)
      assert.equal(week.entries.length, 2)

      const normalEntry = week.entries.find((e) => e.slot.includes("Normal V3 Event"))
      const waivedEntry = week.entries.find((e) => e.slot.includes("Enemy Raided V3 Event"))

      assert.ok(normalEntry)
      assert.ok(waivedEntry)

      assert.equal(normalEntry.feeKk, PVM_FEE_KK)
      assert.equal(normalEntry.feeWaived, false)

      assert.equal(waivedEntry.feeKk, 0)
      assert.equal(waivedEntry.feeWaived, true)
      assert.ok(waivedEntry.feeWaivedReason?.includes("Wróg na V3"))
    })
  })
})
