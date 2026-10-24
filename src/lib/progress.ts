import { and, asc, count, desc, eq, inArray, isNull, max, or } from "drizzle-orm"
import { getDb } from "@/lib/db"
import {
  characterReportImages,
  characterReports,
  guildAdmins,
  guilds,
  userCharacters,
  users,
  type User,
} from "@/lib/db/schema"
import { parseEntries } from "@/lib/progress-fields"

export type CharacterReport = typeof characterReports.$inferSelect & { images: { id: string; kind: string }[] }

export type EntryDiff = {
  name: string
  value: string
  before?: string
  status: "same" | "changed" | "new" | "removed"
}

/** Compares entries by name (case-insensitive). Without an earlier report nothing counts as changed. */
export function diffEntries(current: string, previous: string | undefined): EntryDiff[] {
  const now = parseEntries(current)
  if (previous === undefined) return now.map((e) => ({ ...e, status: "same" }))
  const before = new Map(parseEntries(previous).map((e) => [e.name.toLowerCase(), e]))
  const result: EntryDiff[] = now.map((e) => {
    const old = before.get(e.name.toLowerCase())
    before.delete(e.name.toLowerCase())
    if (!old) return { ...e, status: "new" }
    return old.value === e.value ? { ...e, status: "same" } : { ...e, before: old.value, status: "changed" }
  })
  for (const old of before.values()) result.push({ name: old.name, value: "", before: old.value, status: "removed" })
  return result
}

/** Characters a user may see and edit: super admin all, admin own plus their guilds', player own. */
export async function characterScope(user: User) {
  if (user.isSuperAdmin) return undefined
  const own = eq(userCharacters.userId, user.id)
  if (!user.isLeader) return own
  const db = await getDb()
  const adminOf = db.select({ id: guildAdmins.guildId }).from(guildAdmins).where(eq(guildAdmins.userId, user.id))
  return or(own, inArray(userCharacters.guildId, adminOf))
}

/** With the guild name and class / levels from the newest report, for filtering the list. */
export async function listProgressCharacters(user: User) {
  const db = await getDb()
  const [rows, classes] = await Promise.all([
    db
      .select({
        id: userCharacters.id,
        name: userCharacters.name,
        userId: userCharacters.userId,
        ownerNick: users.gameNick,
        guildName: guilds.name,
        reports: count(characterReports.id),
        lastReportAt: max(characterReports.createdAt),
      })
      .from(userCharacters)
      .innerJoin(users, eq(users.id, userCharacters.userId))
      .leftJoin(guilds, eq(guilds.id, userCharacters.guildId))
      .leftJoin(characterReports, eq(characterReports.characterId, userCharacters.id))
      .where(and(isNull(users.deletedAt), await characterScope(user)))
      .groupBy(userCharacters.id, users.gameNick, guilds.name)
      .orderBy(asc(userCharacters.name)),
    db
      .selectDistinctOn([characterReports.characterId], {
        characterId: characterReports.characterId,
        characterClass: characterReports.characterClass,
        level: characterReports.level,
        horseLevel: characterReports.horseLevel,
      })
      .from(characterReports)
      .orderBy(characterReports.characterId, desc(characterReports.createdAt)),
  ])
  const latest = new Map(classes.map((c) => [c.characterId, c]))
  return rows.map((r) => {
    const l = latest.get(r.id)
    return { ...r, characterClass: l?.characterClass ?? "", level: l?.level ?? null, horseLevel: l?.horseLevel ?? null }
  })
}

/** Newest first. */
export async function listCharacterReports(characterId: string): Promise<CharacterReport[]> {
  const db = await getDb()
  const reports = await db
    .select()
    .from(characterReports)
    .where(eq(characterReports.characterId, characterId))
    .orderBy(desc(characterReports.createdAt))
  if (!reports.length) return []
  const images = await db
    .select({
      id: characterReportImages.id,
      kind: characterReportImages.kind,
      reportId: characterReportImages.reportId,
    })
    .from(characterReportImages)
    .where(
      inArray(
        characterReportImages.reportId,
        reports.map((r) => r.id),
      ),
    )
    .orderBy(asc(characterReportImages.createdAt))
  return reports.map((r) => ({
    ...r,
    images: images.filter((i) => i.reportId === r.id).map(({ id, kind }) => ({ id, kind })),
  }))
}

/** Each character's newest report, for prefilling the next one. */
export async function latestReports(characterIds: string[]): Promise<Map<string, CharacterReport>> {
  const result = new Map<string, CharacterReport>()
  // shortcut: one query per character, fine for a player's handful of characters.
  for (const id of characterIds) {
    const [report] = await listCharacterReports(id)
    if (report) result.set(id, report)
  }
  return result
}
