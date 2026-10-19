import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { guildEventImages } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 })
  const { id } = await params
  const db = await getDb()
  const [image] = await db
    .select({ mimeType: guildEventImages.mimeType, data: guildEventImages.data })
    .from(guildEventImages)
    .where(eq(guildEventImages.id, id))
  if (!image) return new Response("Not found", { status: 404 })

  return new Response(Buffer.from(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      // Image ids are never reused, so the browser can keep them for good.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
