import { AdminNav } from "@/components/admin-nav"
import { AdminUsers } from "@/components/admin-users"
import { AdminYellowCards } from "@/components/admin-yellow-cards"
import { listUsers } from "@/lib/queries"
import { requireLeader } from "@/lib/session"
import { listAllPenalties } from "@/lib/actions/penalties"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const leader = await requireLeader()

  const [users, penalties] = await Promise.all([
    listUsers(),
    listAllPenalties(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Admin — Zarządzanie</h1>
        <p className="text-sm text-muted-foreground">
          Zarządzaj członkami gildii: uprawnienia, weryfikacja kont, role i tagi oraz nadawanie żółtych kartek.
        </p>
      </div>

      <AdminNav />

      <AdminYellowCards
        penalties={penalties}
        allUsers={users.map((u) => ({ id: u.id, gameNick: u.gameNick }))}
      />

      <AdminUsers
        currentUserId={leader.id}
        users={users.map((user) => ({
          id: user.id,
          gameNick: user.gameNick,
          discordName: user.discordName,
          login: user.login,
          hasDiscord: Boolean(user.discordId),
          playstyle: user.playstyle,
          isLeader: user.isLeader,
          isVerified: user.isVerified ?? false,
          roles: user.roles || "[]",
        }))}
      />
    </div>
  )
}
