"use server"

import { and, count, eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { characterReportImages, characterReports, userCharacters } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { characterScope } from "@/lib/progress"
import { requireUser } from "@/lib/session"
import { CLASS_SKILLS, IMAGE_KINDS, parseEntries } from "@/lib/progress-fields"

const ALLOWED_TYPES = new Set(["image/webp", "image/png", "image/jpeg"])
const MAX_BYTES = 3.5 * 1024 * 1024 // under next.config's 4mb server-action limit
const MAX_PER_REPORT = 20

export type ReportInput = {
  level: string
  horseLevel: string
  characterClass: string
  biolog: string
  skills: string
  equipment: string
  notes: string
}

/** Only the owner, an admin of the character's guild or the super admin may change its reports. */
async function canEditCharacter(characterId: string) {
  const user = await requireUser()
  const db = await getDb()
  const [character] = await db
    .select({ id: userCharacters.id })
    .from(userCharacters)
    .where(and(eq(userCharacters.id, characterId), await characterScope(user)))
  return { db, allowed: !!character, user }
}

async function canEditReport(reportId: string) {
  const db = await getDb()
  const [report] = await db
    .select({ characterId: characterReports.characterId })
    .from(characterReports)
    .where(eq(characterReports.id, reportId))
  return report ? (await canEditCharacter(report.characterId)).allowed : false
}

export async function createCharacterReport(characterId: string, input: ReportInput): Promise<ActionResult<string>> {
  const { db, allowed, user } = await canEditCharacter(characterId)
  if (!allowed) return fail("Możesz dodawać raporty tylko swoich postaci.")

  const short = [input.characterClass, input.biolog].map((v) => v.trim())
  const long = [input.skills, input.equipment, input.notes].map((v) => v.trim())
  const blankEntry = [long[0], long[1]].some((text) => !text || parseEntries(text).some((e) => !e.value))
  if (!input.level.trim() || !input.horseLevel.trim() || short.some((v) => !v) || blankEntry)
    return fail("Uzupełnij wszystkie pola (opis i screenshoty są opcjonalne).")
  const level = Number(input.level)
  if (!Number.isInteger(level) || level < 1 || level > 999) return fail("Poziom musi być liczbą 1–999.")
  const horseLevel = Number(input.horseLevel)
  if (!Number.isInteger(horseLevel) || horseLevel < 0 || horseLevel > 30) return fail("Poziom konia musi być liczbą 0–30.")
  if (!(short[0] in CLASS_SKILLS)) return fail("Wybierz klasę z listy.")
  if (short[1].length > 100) return fail("Biolog może mieć max 100 znaków.")
  if (long.some((v) => v.length > 4000)) return fail("Umiejętności, EQ wojenne i opis mogą mieć max 4000 znaków.")

  const id = crypto.randomUUID()
  await db.insert(characterReports).values({
    id,
    characterId,
    createdBy: user.id,
    level,
    horseLevel,
    characterClass: short[0],
    biolog: short[1],
    skills: long[0],
    equipment: long[1],
    notes: long[2],
  })
  return ok("Zapisano raport.", id)
}

export async function deleteCharacterReport(id: string): Promise<ActionResult> {
  if (!(await canEditReport(id))) return fail("Możesz usuwać tylko raporty swoich postaci.")
  const db = await getDb()
  await db.delete(characterReports).where(eq(characterReports.id, id))
  return ok("Usunięto raport.")
}

/** One screenshot per call; the browser uploads a multi-file selection one by one. */
export async function uploadReportImage(reportId: string, formData: FormData): Promise<ActionResult> {
  if (!(await canEditReport(reportId))) return fail("Możesz dodawać screenshoty tylko do raportów swoich postaci.")
  const file = formData.get("file")
  const kind = formData.get("kind")
  if (!(file instanceof File)) return fail("Nie wybrano pliku.")
  if (typeof kind !== "string" || !IMAGE_KINDS.includes(kind)) return fail("Nieznana sekcja screenshotu.")
  if (!ALLOWED_TYPES.has(file.type)) return fail("Dozwolone są tylko obrazy PNG, JPG lub WebP.")
  if (file.size > MAX_BYTES) return fail("Plik jest za duży (max 3,5 MB).")

  const db = await getDb()
  const [{ total }] = await db
    .select({ total: count() })
    .from(characterReportImages)
    .where(eq(characterReportImages.reportId, reportId))
  if (total >= MAX_PER_REPORT) return fail(`Raport ma już ${MAX_PER_REPORT} screenshotów.`)

  await db.insert(characterReportImages).values({
    id: crypto.randomUUID(),
    reportId,
    kind,
    mimeType: file.type,
    data: new Uint8Array(await file.arrayBuffer()),
  })
  return ok()
}

export async function deleteReportImage(id: string): Promise<ActionResult> {
  const db = await getDb()
  const [image] = await db
    .select({ reportId: characterReportImages.reportId })
    .from(characterReportImages)
    .where(eq(characterReportImages.id, id))
  if (!image) return fail("Nie znaleziono screenshotu.")
  if (!(await canEditReport(image.reportId))) return fail("Możesz usuwać tylko screenshoty swoich postaci.")
  await db.delete(characterReportImages).where(eq(characterReportImages.id, id))
  return ok("Usunięto screenshot.")
}
