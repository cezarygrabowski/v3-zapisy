import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { inArray } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildEvents, guildEventSignups, konwojGroupMembers, konwojGroups, konwojWeeks, users } from "@/lib/db/schema"
import { getKonwojWeek, listKonwojGroups, splitKonwojPool } from "@/lib/konwoj"

describe("splitKonwojPool", () => {
  test("splits proportionally to runs, floors shares and keeps the leftover", () => {
    const { shares, totalRuns, leftoverKk } = splitKonwojPool(
      1000,
      [
        { userId: "a", gameNick: "Alfa", runs: 1 },
        { userId: "b", gameNick: "Beta", runs: 2 },
        { userId: "c", gameNick: "Gamma", runs: 0 },
      ],
      new Set(["b"])
    )
    assert.equal(totalRuns, 3)
    assert.deepEqual(
      shares.map((s) => [s.userId, s.shareKk, s.paid]),
      [
        ["b", 666, true],
        ["a", 333, false],
        ["c", 0, false],
      ]
    )
    assert.equal(leftoverKk, 1)
  })

  test("with nobody attending the whole pool is leftover", () => {
    assert.deepEqual(splitKonwojPool(500, []), { shares: [], totalRuns: 0, leftoverKk: 500 })
  })
})

describe("getKonwojWeek", () => {
  const ts = Date.now()
  const week = "2001-01-01" // Monday far in the past so it never shows in the real UI
  const [u1, u2, u3, u4] = [`konwoj-u1-${ts}`, `konwoj-u2-${ts}`, `konwoj-u3-${ts}`, `konwoj-u4-${ts}`]
  const [gA, gB] = [`konwoj-ga-${ts}`, `konwoj-gb-${ts}`]
  const [e1, e2, eCancelled, eV3, eOther] = ["e1", "e2", "ec", "ev3", "eb"].map((k) => `konwoj-${k}-${ts}`)

  test.before(async () => {
    const db = await getDb()
    await db.insert(users).values(
      [u1, u2, u3, u4].map((id, i) => ({ id, discordName: `k${i}_${ts}`, gameNick: `Konwoj${i + 1}_${ts}`, isVerified: true }))
    )
    await db.insert(konwojGroups).values([
      { id: gA, name: `A_${ts}` },
      { id: gB, name: `B_${ts}` },
    ])
    await db.insert(konwojGroupMembers).values([
      { userId: u1, groupId: gA, isTreasurer: true },
      { userId: u2, groupId: gA },
      { userId: u3, groupId: gA }, // member without runs
    ])
    const base = { title: "Konwój", startTime: "19:00", endTime: "21:00", createdBy: u1 }
    await db.insert(guildEvents).values([
      { ...base, id: e1, type: "konwoj", date: "2001-01-01", konwojGroupId: gA },
      { ...base, id: e2, type: "konwoj", date: "2001-01-07", konwojGroupId: gA },
      { ...base, id: eCancelled, type: "konwoj", date: "2001-01-03", status: "cancelled", konwojGroupId: gA },
      { ...base, id: eV3, type: "v3", date: "2001-01-02" },
      { ...base, id: eOther, type: "konwoj", date: "2001-01-04", konwojGroupId: gB },
    ])
    const s = (id: string, eventId: string, userId: string, attended: boolean, hasHorse: boolean) => ({
      id: `${id}-${ts}`,
      eventId,
      userId,
      attended,
      hasHorse,
    })
    await db.insert(guildEventSignups).values([
      s("s1", e1, u1, true, true),
      s("s1b", e1, u1, true, false), // second character in the same run
      s("s2", e1, u2, false, true), // no-show
      s("s3", e2, u1, true, true),
      s("s4", e2, u2, true, false),
      s("s5", eCancelled, u2, true, true),
      s("s6", eV3, u2, true, true),
      s("s7", eOther, u2, true, true), // another group's run
      s("s8", e1, u4, true, true), // came on Monday before being assigned to any group
    ])
    await db.insert(konwojWeeks).values([
      { groupId: gA, weekStart: week, shopYangKk: 200, shopItemsValueKk: 100, collectorName: "Zbieracz" },
      { groupId: gB, weekStart: week, shopYangKk: 999, shopItemsValueKk: 999 },
    ])
  })

  test.after(async () => {
    const db = await getDb()
    await db.delete(guildEvents).where(inArray(guildEvents.id, [e1, e2, eCancelled, eV3, eOther]))
    await db.delete(konwojGroups).where(inArray(konwojGroups.id, [gA, gB]))
    await db.delete(users).where(inArray(users.id, [u1, u2, u3, u4]))
  })

  test("splits yang + estimated item value within the group by distinct attended runs", async () => {
    const group = (await listKonwojGroups()).find((g) => g.id === gA)!
    const result = await getKonwojWeek(group, week)
    assert.equal(result.poolKk, 300) // 200 yang + 100 estimated items
    assert.equal(result.collectorName, "Zbieracz")
    assert.deepEqual(
      result.shares.map((s) => [s.userId, s.runs, s.shareKk]),
      [
        [u1, 2, 200],
        [u2, 1, 100],
        [u3, 0, 0],
      ]
    )
    assert.deepEqual(result.unassigned, [{ userId: u4, gameNick: `Konwoj4_${ts}`, runs: 1 }])
    assert.deepEqual(
      result.runs.map((r) => [r.id, r.signups, r.attended, r.horses]),
      [
        [e1, 4, 3, 3],
        [e2, 2, 2, 1],
      ]
    )
  })

  test("counts earlier runs of a player assigned to the group later in the week", async () => {
    const db = await getDb()
    await db.insert(konwojGroupMembers).values({ userId: u4, groupId: gA })
    const group = (await listKonwojGroups()).find((g) => g.id === gA)!
    const result = await getKonwojWeek(group, week)
    assert.deepEqual(result.unassigned, [])
    assert.deepEqual(
      result.shares.map((s) => [s.userId, s.runs, s.shareKk]),
      [
        [u1, 2, 150],
        [u2, 1, 75],
        [u4, 1, 75],
        [u3, 0, 0],
      ]
    )
  })
})
