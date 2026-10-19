import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { findUserById } from "@/lib/db/users"
import { listUsers } from "@/lib/queries"

describe("deleted users", () => {
  const id = `deleted-u-${Date.now()}`

  test.after(async () => {
    const db = await getDb()
    await db.delete(users).where(eq(users.id, id))
  })

  test("a soft-deleted account loses its session lookup and leaves user lists", async () => {
    const db = await getDb()
    await db.insert(users).values({ id, discordName: id, gameNick: id, isVerified: true })
    assert.equal((await findUserById(id))?.id, id)

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id))
    assert.equal(await findUserById(id), null)
    assert.equal(
      (await listUsers()).some((u) => u.id === id),
      false
    )
  })
})
