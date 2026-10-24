import { asc, count, eq, isNull } from "drizzle-orm"
import { AdminGuilds } from "@/components/admin-guilds"
import { AdminNav } from "@/components/admin-nav"
import { getDb } from "@/lib/db"
import { guilds, userCharacters, users } from "@/lib/db/schema"
import { requireSuperAdmin } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function AdminGildiePage() {
  await requireSuperAdmin()
  const db = await getDb()
  const [guildRows, characters] = await Promise.all([
    db
      .select({ id: guilds.id, name: guilds.name, characters: count(userCharacters.id) })
      .from(guilds)
      .leftJoin(userCharacters, eq(userCharacters.guildId, guilds.id))
      .groupBy(guilds.id)
      .orderBy(asc(guilds.name)),
    db
      .select({
        id: userCharacters.id,
        name: userCharacters.name,
        ownerNick: users.gameNick,
        guildId: userCharacters.guildId,
      })
      .from(userCharacters)
      .innerJoin(users, eq(users.id, userCharacters.userId))
      .where(isNull(users.deletedAt))
      .orderBy(asc(userCharacters.name)),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Admin — Gildie</h1>
        <p className="text-sm text-muted-foreground">
          Twórz gildie i przypisuj do nich postacie. Admina z wybraną gildią nadajesz w zakładce Użytkownicy.
        </p>
      </div>
      <AdminNav isSuperAdmin />
      <AdminGuilds guilds={guildRows} characters={characters} />
    </div>
  )
}
