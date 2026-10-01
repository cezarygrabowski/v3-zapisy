import { PersonalAlerts } from "@/components/personal-alerts"
import { listUserCharacters } from "@/lib/actions/characters"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function AlertsPage() {
  const user = await requireUser()
  const characters = await listUserCharacters(user.id)
  return <PersonalAlerts characters={characters.map(({ id, name }) => ({ id, name }))} />
}
