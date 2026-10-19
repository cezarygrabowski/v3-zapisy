import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildEventImages, guildEvents, users } from "@/lib/db/schema"
import { getGuildEventDetails } from "@/lib/calendar-queries"

describe("guild event images", () => {
  const ts = Date.now()
  const [userId, eventId, imageId] = [`img-u-${ts}`, `img-e-${ts}`, `img-i-${ts}`]

  test.after(async () => {
    const db = await getDb()
    await db.delete(guildEvents).where(eq(guildEvents.id, eventId))
    await db.delete(users).where(eq(users.id, userId))
  })

  test("stores screenshot bytes and lists them on the event", async () => {
    const db = await getDb()
    await db
      .insert(users)
      .values({ id: userId, discordName: `img_${ts}`, gameNick: `Fotograf_${ts}`, isVerified: true })
    await db.insert(guildEvents).values({
      id: eventId,
      title: "Konwój",
      type: "konwoj",
      date: "2001-01-01",
      startTime: "19:00",
      createdBy: userId,
    })
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 255, 128])
    await db
      .insert(guildEventImages)
      .values({ id: imageId, eventId, uploadedBy: userId, mimeType: "image/webp", data: bytes })

    const [stored] = await db.select().from(guildEventImages).where(eq(guildEventImages.id, imageId))
    assert.deepEqual(Array.from(stored.data), Array.from(bytes))

    const details = await getGuildEventDetails(eventId)
    assert.deepEqual(
      details?.images?.map((i) => [i.id, i.uploadedById, i.uploadedByNick]),
      [[imageId, userId, `Fotograf_${ts}`]]
    )
  })
})
