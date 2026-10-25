import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { inArray } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { characterReports, guildAdmins, guilds, userCharacters, users, type User } from "@/lib/db/schema"
import { listProgressCharacters } from "@/lib/progress"

describe("guild scope on /postep", () => {
  const p = `gs-${Date.now()}`
  const ids = { player: `${p}-player`, admin: `${p}-admin`, boss: `${p}-boss` }
  const names = (rows: { name: string }[]) =>
    rows
      .map((r) => r.name)
      .filter((n) => n.startsWith(p))
      .sort()

  test.after(async () => {
    const db = await getDb()
    await db.delete(users).where(inArray(users.id, Object.values(ids)))
    await db.delete(guilds).where(inArray(guilds.id, [`${p}-ob`, `${p}-frosty`]))
  })

  test("player sees own, guild admin own plus guild, super admin all", async () => {
    const db = await getDb()
    await db.insert(guilds).values([
      { id: `${p}-ob`, name: `${p}-OB` },
      { id: `${p}-frosty`, name: `${p}-Frosty` },
    ])
    await db.insert(users).values([
      { id: ids.player, discordName: ids.player, gameNick: ids.player },
      { id: ids.admin, discordName: ids.admin, gameNick: ids.admin, isLeader: true },
      { id: ids.boss, discordName: ids.boss, gameNick: ids.boss, isLeader: true, isSuperAdmin: true },
    ])
    await db.insert(guildAdmins).values({ userId: ids.admin, guildId: `${p}-ob` })
    await db.insert(userCharacters).values([
      { id: `${p}-c1`, userId: ids.player, name: `${p}-ob-char`, guildId: `${p}-ob` },
      { id: `${p}-c2`, userId: ids.player, name: `${p}-frosty-char`, guildId: `${p}-frosty` },
      { id: `${p}-c3`, userId: ids.player, name: `${p}-no-guild` },
      { id: `${p}-c4`, userId: ids.admin, name: `${p}-admin-own` },
    ])
    const get = async (id: string) =>
      names(
        await listProgressCharacters((await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, id) })) as User),
      )

    assert.deepEqual(await get(ids.player), [`${p}-frosty-char`, `${p}-no-guild`, `${p}-ob-char`])
    assert.deepEqual(await get(ids.admin), [`${p}-admin-own`, `${p}-ob-char`])
    assert.equal((await get(ids.boss)).length, 4)
  })

  test("characters with the newest report come first, those without one last", async () => {
    const db = await getDb()
    await db.insert(characterReports).values([
      { id: `${p}-r1`, characterId: `${p}-c3`, createdBy: ids.player, createdAt: new Date(Date.now() - 60_000) },
      { id: `${p}-r2`, characterId: `${p}-c2`, createdBy: ids.player },
    ])
    const player = (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, ids.player) })) as User
    const order = (await listProgressCharacters(player)).map((r) => r.name).filter((n) => n.startsWith(p))
    assert.deepEqual(order, [`${p}-frosty-char`, `${p}-no-guild`, `${p}-ob-char`])
  })
})
