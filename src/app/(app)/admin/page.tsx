import { AdminNav } from "@/components/admin-nav"
import { AdminUsers } from "@/components/admin-users"
import { AdminYellowCards } from "@/components/admin-yellow-cards"
import { getDb } from "@/lib/db"
import { guildAdmins, guilds } from "@/lib/db/schema"
import { listUsers } from "@/lib/queries"
import { requireLeader } from "@/lib/session"
import { listAllPenalties } from "@/lib/actions/penalties"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const leader = await requireLeader()

  const db = await getDb()
  const [users, penalties, guildRows, adminRows] = await Promise.all([
    listUsers(),
    listAllPenalties(),
    db.select({ id: guilds.id, name: guilds.name }).from(guilds).orderBy(guilds.name),
    db.select().from(guildAdmins),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Admin — Zarządzanie</h1>
        <p className="text-sm text-muted-foreground">
          Zarządzaj członkami gildii: uprawnienia, weryfikacja kont, role i tagi oraz nadawanie żółtych kartek.
        </p>
      </div>

      <AdminNav isSuperAdmin={leader.isSuperAdmin} />

      <AdminYellowCards
        penalties={penalties}
        allUsers={users.map((u) => ({ id: u.id, gameNick: u.gameNick }))}
      />

      <AdminUsers
        currentUserId={leader.id}
        isSuperAdmin={leader.isSuperAdmin}
        guilds={guildRows}
        users={users.map((user) => ({
          id: user.id,
          gameNick: user.gameNick,
          discordName: user.discordName,
          login: user.login,
          hasDiscord: Boolean(user.discordId),
          playstyle: user.playstyle,
          isLeader: user.isLeader,
          isSuperAdmin: user.isSuperAdmin,
          adminGuildIds: adminRows.filter((a) => a.userId === user.id).map((a) => a.guildId),
          isVerified: user.isVerified ?? false,
          roles: user.roles || "[]",
        }))}
      />
    </div>
  )
}
