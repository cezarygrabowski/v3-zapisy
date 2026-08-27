import { eq } from "drizzle-orm"
import { envLeaderDiscordIds } from "@/lib/constants"
import { getDb } from "@/lib/db"
import { users, type User } from "@/lib/db/schema"
import { hashPassword, parseLogin, parsePassword } from "@/lib/password"

function newId(): string {
  return crypto.randomUUID()
}

export async function upsertDiscordUser(input: {
  discordId: string
  discordName: string
}): Promise<User> {
  const db = await getDb()
  const envLeader = envLeaderDiscordIds().has(input.discordId)
  const existing = await db.query.users.findFirst({
    where: eq(users.discordId, input.discordId),
  })

  if (existing) {
    const isLeader = existing.isLeader || envLeader
    if (existing.discordName !== input.discordName || isLeader !== existing.isLeader) {
      const [updated] = await db
        .update(users)
        .set({ discordName: input.discordName, isLeader })
        .where(eq(users.id, existing.id))
        .returning()
      return updated
    }
    return existing
  }

  const [created] = await db
    .insert(users)
    .values({
      id: newId(),
      discordId: input.discordId,
      discordName: input.discordName,
      gameNick: input.discordName,
      isLeader: envLeader,
    })
    .returning()
  return created
}

export async function upsertDevUser(name: string, isLeader: boolean): Promise<User> {
  const db = await getDb()
  const nick = name.trim() || "Dev"
  const discordId = `dev:${nick.toLowerCase()}`
  const existing = await db.query.users.findFirst({
    where: eq(users.discordId, discordId),
  })

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ isLeader, discordName: nick, gameNick: existing.gameNick || nick })
      .where(eq(users.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(users)
    .values({
      id: newId(),
      discordId,
      discordName: nick,
      gameNick: nick,
      isLeader,
    })
    .returning()
  return created
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await getDb()
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

export async function findUserByLogin(login: string): Promise<User | null> {
  const normalized = parseLogin(login)
  if (!normalized) return null
  const db = await getDb()
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.login, normalized))
    .limit(1)
  return row ?? null
}

export async function createPasswordUser(input: {
  gameNick: string
  login: string
  password: string
  playstyle: string | null
  isLeader: boolean
}): Promise<User> {
  const login = parseLogin(input.login)
  if (!login) throw new Error("LOGIN")
  const password = parsePassword(input.password)
  if (!password) throw new Error("PASSWORD")

  const db = await getDb()
  const [created] = await db
    .insert(users)
    .values({
      id: newId(),
      discordName: input.gameNick,
      gameNick: input.gameNick,
      login,
      passwordHash: await hashPassword(password),
      playstyle: input.playstyle,
      isLeader: input.isLeader,
    })
    .returning()
  return created
}
