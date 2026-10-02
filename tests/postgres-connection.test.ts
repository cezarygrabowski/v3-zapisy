import test from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { getDb, isUniqueViolation } from "../src/lib/db/index"
import { users, userCharacters } from "../src/lib/db/schema"
import { savePersonalTimer, completePersonalTimer, listPersonalTimers } from "../src/lib/personal-timers"

test("PostgreSQL: queries, timestamps, unique errors and cascading deletion", {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL!)
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Integration database must be local")
  assert.equal(url.pathname, "/elder_hub_test", "Integration test requires a dedicated database")
  process.env.DATABASE_URL = url.toString()
  const db = await getDb()
  const id = crypto.randomUUID()
  const characterId = crypto.randomUUID()
  try {
    await db.insert(users).values({ id, discordName: id, gameNick: id })
    await assert.rejects(async () => {
      await db.insert(users).values({ id, discordName: id, gameNick: id })
    }, isUniqueViolation)
    await db.insert(userCharacters).values({ id: characterId, userId: id, name: id })
    assert.equal((await savePersonalTimer(id, { name: "Biolog", intervalMinutes: 60, characterId })).ok, true)
    let [timer] = await listPersonalTimers(id)
    assert.equal(timer.characterName, id)
    assert.equal((await completePersonalTimer(id, timer.id)).ok, true)
    ;[timer] = await listPersonalTimers(id)
    assert.ok(timer.lastCompletedAt)
    assert.equal(timer.readyAt, Date.parse(timer.lastCompletedAt!) + 3600000)
    await db.delete(userCharacters).where(eq(userCharacters.id, characterId))
    ;[timer] = await listPersonalTimers(id)
    assert.equal(timer.characterId, null)
    await db.delete(users).where(eq(users.id, id))
    assert.deepEqual(await listPersonalTimers(id), [])
  } finally {
    await db.delete(userCharacters).where(eq(userCharacters.id, characterId))
    await db.delete(users).where(eq(users.id, id))
  }
})
