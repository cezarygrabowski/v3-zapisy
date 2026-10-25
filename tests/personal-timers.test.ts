import test from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { getDb } from "../src/lib/db/index"
import { users, userCharacters, personalTimers } from "../src/lib/db/schema"
import { listPersonalTimers, savePersonalTimer, completePersonalTimer, removePersonalTimer, setPersonalTimerRemaining } from "../src/lib/personal-timers"
import { formatCountdown, parseCountdown } from "../src/lib/alert-timer-types"

test("personal timers: validation, ownership, repeat, editing and character deletion", async () => {
  assert.equal(process.env.DATABASE_URL || "", "", "Tests must not run against a remote database")
  const db = await getDb()
  const owner = crypto.randomUUID()
  const other = crypto.randomUUID()
  const characterId = crypto.randomUUID()
  await db.insert(users).values([
    { id: owner, discordName: owner, gameNick: owner },
    { id: other, discordName: other, gameNick: other },
  ])
  await db.insert(userCharacters).values({ id: characterId, userId: owner, name: characterId })
  try {
    const input = { name: "Biolog", intervalMinutes: 60, characterId }
    for (const intervalMinutes of [0, -1, 0.5, NaN, Infinity, 525601]) {
      assert.equal((await savePersonalTimer(owner, { ...input, intervalMinutes })).ok, false)
    }
    assert.equal((await savePersonalTimer(owner, { ...input, name: " " })).ok, false)
    assert.equal((await savePersonalTimer(other, input)).ok, false)
    assert.equal((await savePersonalTimer(owner, input)).ok, true)
    let [timer] = await listPersonalTimers(owner)
    assert.equal(timer.name, "Biolog")
    assert.equal(timer.characterName, characterId)
    assert.ok(timer.readyAt <= Date.now())
    assert.equal((await listPersonalTimers(other)).length, 0)
    assert.equal((await savePersonalTimer(other, { ...input, characterId: null, id: timer.id })).ok, false)
    assert.equal((await completePersonalTimer(other, timer.id)).ok, false)
    assert.equal((await removePersonalTimer(other, timer.id)).ok, false)
    assert.equal((await completePersonalTimer(owner, timer.id)).ok, true)
    ;[timer] = await listPersonalTimers(owner)
    assert.ok(timer.lastCompletedAt)
    assert.equal(timer.readyAt, Date.parse(timer.lastCompletedAt!) + 3600000)
    for (const seconds of [-1, 1.5, NaN, 525600 * 60 + 1]) {
      assert.equal((await setPersonalTimerRemaining(owner, timer.id, seconds)).ok, false)
    }
    assert.equal((await setPersonalTimerRemaining(other, timer.id, 60)).ok, false)
    const before = Date.now()
    assert.equal((await setPersonalTimerRemaining(owner, timer.id, 5400)).ok, true)
    ;[timer] = await listPersonalTimers(owner)
    assert.ok(timer.readyAt >= before + 5400000 && timer.readyAt <= Date.now() + 5400000)
    const lastCompletedAt = timer.lastCompletedAt
    assert.equal((await savePersonalTimer(owner, { ...input, id: timer.id, name: "Księga", intervalMinutes: 30 })).ok, true)
    ;[timer] = await listPersonalTimers(owner)
    assert.equal(timer.lastCompletedAt, lastCompletedAt)
    assert.equal(timer.readyAt, Date.parse(lastCompletedAt!) + 1800000)
    await db.delete(userCharacters).where(eq(userCharacters.id, characterId))
    ;[timer] = await listPersonalTimers(owner)
    assert.equal(timer.characterId, null)
    assert.equal(timer.characterName, null)
    assert.equal((await removePersonalTimer(owner, timer.id)).ok, true)
    assert.equal((await listPersonalTimers(owner)).length, 0)
    assert.equal((await savePersonalTimer(owner, { ...input, characterId: null, startNow: true })).ok, true)
    ;[timer] = await listPersonalTimers(owner)
    assert.ok(timer.readyAt > Date.now())
    await db.delete(users).where(eq(users.id, owner))
    assert.equal((await db.select().from(personalTimers).where(eq(personalTimers.userId, owner))).length, 0)
  } finally {
    await db.delete(users).where(eq(users.id, owner))
    await db.delete(users).where(eq(users.id, other))
  }
  assert.equal(formatCountdown(1, 0), "00:00:01")
  assert.equal(formatCountdown(0, 1), "00:00:00")
  assert.equal(formatCountdown(90061000, 0), "1 d 01:01:01")
  assert.equal(parseCountdown("1 d 01:01:01"), 90061)
  assert.equal(parseCountdown(" 05:30 "), 19800)
  assert.equal(parseCountdown("30:00:05"), 108005)
  for (const bad of ["", "5", "5:7", "01:60", "01:00:60", "abc"]) assert.equal(parseCountdown(bad), null)
})
