import { redirect } from "next/navigation"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()
  const { id } = await params
  redirect(`/kalendarz?wydarzenie=${id}`)
}
