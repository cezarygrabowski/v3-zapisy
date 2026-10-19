"use server"

import { count, eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildEventImages, guildEvents } from "@/lib/db/schema"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { requireUser } from "@/lib/session"

const ALLOWED_TYPES = new Set(["image/webp", "image/png", "image/jpeg"])
const MAX_BYTES = 3.5 * 1024 * 1024 // under next.config's 4mb server-action limit
const MAX_PER_EVENT = 30

/** One screenshot per call; the browser uploads a multi-file selection one by one. */
export async function uploadEventImage(eventId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser()
  const file = formData.get("file")
  if (!(file instanceof File)) return fail("Nie wybrano pliku.")
  if (!ALLOWED_TYPES.has(file.type)) return fail("Dozwolone są tylko obrazy PNG, JPG lub WebP.")
  if (file.size > MAX_BYTES) return fail("Plik jest za duży (max 3,5 MB).")

  const db = await getDb()
  const [event] = await db.select({ type: guildEvents.type }).from(guildEvents).where(eq(guildEvents.id, eventId))
  if (!event) return fail("Nie znaleziono wydarzenia.")
  if (event.type !== "konwoj") return fail("Screenshoty dropu można dodawać tylko do Konwoju.")

  const [{ total }] = await db
    .select({ total: count() })
    .from(guildEventImages)
    .where(eq(guildEventImages.eventId, eventId))
  if (total >= MAX_PER_EVENT) return fail(`Wydarzenie ma już ${MAX_PER_EVENT} screenshotów.`)

  await db.insert(guildEventImages).values({
    id: crypto.randomUUID(),
    eventId,
    uploadedBy: user.id,
    mimeType: file.type,
    data: new Uint8Array(await file.arrayBuffer()),
  })
  return ok("Dodano screenshot.")
}

export async function deleteEventImage(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const db = await getDb()
  const [image] = await db
    .select({ uploadedBy: guildEventImages.uploadedBy })
    .from(guildEventImages)
    .where(eq(guildEventImages.id, id))
  if (!image) return fail("Nie znaleziono screenshotu.")
  if (!user.isLeader && image.uploadedBy !== user.id) return fail("Możesz usunąć tylko swoje screenshoty.")

  await db.delete(guildEventImages).where(eq(guildEventImages.id, id))
  return ok("Usunięto screenshot.")
}
