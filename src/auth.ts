import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Discord from "next-auth/providers/discord"
import { isDevLoginEnabled } from "@/lib/constants"
import { findUserByLogin, upsertDevUser, upsertDiscordUser } from "@/lib/db/users"
import { verifyPassword } from "@/lib/password"

class GuildAccessDenied extends CredentialsSignin {
  code = "NotInGuild"
}

async function isInGuild(accessToken: string): Promise<boolean> {
  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) return false

  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return false

  const guilds = (await response.json()) as { id: string }[]
  return guilds.some((guild) => guild.id === guildId)
}

function discordNameFromProfile(profile: {
  name?: string | null
  username?: string | null
  global_name?: string | null
}): string {
  return profile.global_name || profile.name || profile.username || "Gracz"
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const discordConfigured = Boolean(
    process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET
  )

  return {
    trustHost: true,
    pages: {
      signIn: "/login",
      error: "/login",
    },
    providers: [
      ...(discordConfigured
        ? [
            Discord({
              authorization: { params: { scope: "identify guilds" } },
            }),
          ]
        : []),
      Credentials({
        id: "password",
        name: "Hasło",
        credentials: {
          login: { label: "Login", type: "text" },
          password: { label: "Hasło", type: "password" },
        },
        authorize: async (credentials) => {
          const login = String(credentials.login ?? "")
          const password = String(credentials.password ?? "")
          const user = await findUserByLogin(login)
          if (!user?.passwordHash) return null
          const matches = await verifyPassword(password, user.passwordHash)
          if (!matches) return null
          return { id: user.id, name: user.gameNick }
        },
      }),
      ...(isDevLoginEnabled()
        ? [
            Credentials({
              id: "dev",
              name: "Dev",
              credentials: {
                name: { label: "Nick", type: "text" },
                leader: { label: "Admin", type: "text" },
              },
              authorize: async (credentials) => {
                if (!isDevLoginEnabled()) return null
                const name = String(credentials.name ?? "Dev")
                const isLeader = String(credentials.leader ?? "") === "true"
                const user = await upsertDevUser(name, isLeader)
                return { id: user.id, name: user.gameNick }
              },
            }),
          ]
        : []),
    ],
    callbacks: {
      async signIn({ account }) {
        if (account?.provider === "password") return true
        if (account?.provider === "dev") {
          return isDevLoginEnabled()
        }
        if (account?.provider === "discord" && account.access_token) {
          const ok = await isInGuild(account.access_token)
          if (!ok) throw new GuildAccessDenied()
          return true
        }
        return false
      },
      async jwt({ token, account, profile, user }) {
        if (user?.id) {
          token.sub = user.id
        }
        if (account?.provider === "discord" && profile && "id" in profile) {
          const row = await upsertDiscordUser({
            discordId: String(profile.id),
            discordName: discordNameFromProfile(
              profile as {
                name?: string | null
                username?: string | null
                global_name?: string | null
              }
            ),
          })
          token.sub = row.id
        }
        return token
      },
      async session({ session, token }) {
        if (token.sub) {
          session.user.id = token.sub
        }
        return session
      },
    },
  }
})
