import test, { describe } from "node:test"
import assert from "node:assert/strict"
import {
  clearAllV3Enemies,
  deleteV3Enemy,
  getV3Enemies,
  quickAddV3Enemy,
  toggleV3EnemyStatus,
} from "@/lib/actions/enemies"

import { getDb } from "@/lib/db"
import { users } from "@/lib/db/schema"

describe("V3 Enemy Radar Actions & Business Logic", () => {
  let testActor = {
    actorUserId: "",
    actorNick: "TestHero",
  }

  test.before(async () => {
    const db = await getDb()
    let [u] = await db.select({ id: users.id, gameNick: users.gameNick }).from(users).limit(1)
    if (!u) {
      const id = "test-actor-user"
      await db
        .insert(users)
        .values({
          id,
          discordName: "test_actor",
          gameNick: "TestHero",
          isLeader: true,
          isVerified: true,
        })
        .onConflictDoNothing()
      u = { id, gameNick: "TestHero" }
    }
    testActor = {
      actorUserId: u.id,
      actorNick: u.gameNick,
    }
  })

  test("rejects invalid enemy names", async () => {
    const resEmpty = await quickAddV3Enemy({ name: "" }, testActor)
    assert.equal(resEmpty.ok, false)
    assert.match(resEmpty.error || "", /Podaj prawidłowy nick/)

    const resShort = await quickAddV3Enemy({ name: "A" }, testActor)
    assert.equal(resShort.ok, false)
  })

  test("adds a new enemy and allows immediate marking inside V3", async () => {
    const enemyName = `TestEnemy_${Date.now()}`
    const res = await quickAddV3Enemy(
      {
        name: enemyName,
        guild: "RedDragons",
        characterClass: "Sura",
        markInside: true,
      },
      testActor
    )

    assert.equal(res.ok, true)
    assert.ok(res.data)
    assert.equal(res.data.name, enemyName)
    assert.equal(res.data.guild, "RedDragons")
    assert.equal(res.data.characterClass, "Sura")
    assert.equal(res.data.isInsideV3, true)
    assert.ok(res.data.spottedAt)
    assert.equal(res.data.spottedBy, testActor.actorUserId)

    // Verify it appears in getV3Enemies
    const all = await getV3Enemies()
    const found = all.find((e) => e.name === enemyName)
    assert.ok(found)
    assert.equal(found.isInsideV3, true)

    // Cleanup
    await deleteV3Enemy(res.data.id, { skipAuth: true })
  })

  test("1-click toggle switches enemy state between inside and outside V3", async () => {
    const enemyName = `ToggleEnemy_${Date.now()}`
    const addRes = await quickAddV3Enemy(
      {
        name: enemyName,
        guild: "EnemyGuild",
        characterClass: "Wojownik",
        markInside: false,
      },
      testActor
    )
    assert.equal(addRes.ok, true)
    const enemyId = addRes.data!.id

    // 1. Toggle ON -> should become inside V3
    const toggleOn = await toggleV3EnemyStatus(enemyId, testActor)
    assert.equal(toggleOn.ok, true)
    assert.equal(toggleOn.data?.isInsideV3, true)

    let all = await getV3Enemies()
    let check = all.find((e) => e.id === enemyId)
    assert.equal(check?.isInsideV3, true)
    assert.ok(check?.spottedAt)

    // 2. Toggle OFF -> should become outside V3
    const toggleOff = await toggleV3EnemyStatus(enemyId, testActor)
    assert.equal(toggleOff.ok, true)
    assert.equal(toggleOff.data?.isInsideV3, false)

    all = await getV3Enemies()
    check = all.find((e) => e.id === enemyId)
    assert.equal(check?.isInsideV3, false)
    assert.equal(check?.spottedAt, null)

    // Cleanup
    await deleteV3Enemy(enemyId, { skipAuth: true })
  })

  test("clearAllV3Enemies resets all active enemies at once", async () => {
    const enemy1 = `Enemy_1_${Date.now()}`
    const enemy2 = `Enemy_2_${Date.now()}`

    const res1 = await quickAddV3Enemy({ name: enemy1, markInside: true }, testActor)
    const res2 = await quickAddV3Enemy({ name: enemy2, markInside: true }, testActor)

    assert.equal(res1.ok, true)
    assert.equal(res2.ok, true)

    // Clear all
    const clearRes = await clearAllV3Enemies({ skipAuth: true })
    assert.equal(clearRes.ok, true)

    const all = await getV3Enemies()
    const active = all.filter((e) => e.name === enemy1 || e.name === enemy2)
    assert.ok(active.every((e) => !e.isInsideV3), "All enemies should be outside V3")

    // Cleanup
    await deleteV3Enemy(res1.data!.id, { skipAuth: true })
    await deleteV3Enemy(res2.data!.id, { skipAuth: true })
  })

  test("returns error when toggling non-existent enemy ID", async () => {
    const res = await toggleV3EnemyStatus("non-existent-id", testActor)
    assert.equal(res.ok, false)
    assert.match(res.error || "", /Nie znaleziono wroga/)
  })
})
