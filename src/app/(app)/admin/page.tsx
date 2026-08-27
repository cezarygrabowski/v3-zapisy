import { AdminUsers } from "@/components/admin-users"
import { listUsers } from "@/lib/queries"
import { requireLeader } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  await requireLeader()
  const users = await listUsers()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Nadaj rolę admina, popraw typ postaci i zakładaj konta z loginem. Pierwsi admini biorą się też z
          LEADER_DISCORD_IDS.
        </p>
      </div>
      <AdminUsers
        users={users.map((user) => ({
          id: user.id,
          gameNick: user.gameNick,
          discordName: user.discordName,
          login: user.login,
          hasDiscord: Boolean(user.discordId),
          playstyle: user.playstyle,
          isLeader: user.isLeader,
        }))}
      />
    </div>
  )
}
