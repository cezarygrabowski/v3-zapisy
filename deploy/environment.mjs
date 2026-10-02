import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"

export function renderEnvironment(source) {
  const values = {
    AUTH_URL: "https://elder-hub.pl",
    APP_URL: "https://elder-hub.pl",
    DEV_LOGIN: "false",
  }
  for (const key of ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET"]) {
    assert.ok(source[key], `Missing production secret: ${key}`)
    values[key] = source[key]
  }
  let databaseUrl
  try {
    databaseUrl = new URL(values.DATABASE_URL)
  } catch {
    assert.fail("DATABASE_URL must be a valid PostgreSQL connection string")
  }
  assert.ok(["postgres:", "postgresql:"].includes(databaseUrl.protocol), "DATABASE_URL must point to PostgreSQL")
  const discordKeys = ["AUTH_DISCORD_ID", "AUTH_DISCORD_SECRET", "DISCORD_GUILD_ID"]
  if (discordKeys.some((key) => source[key])) {
    for (const key of discordKeys) assert.ok(source[key], `Missing Discord secret: ${key}`)
  }
  for (const key of [...discordKeys, "LEADER_DISCORD_IDS"]) values[key] = source[key] || ""
  return Object.entries(values).map(([key, value]) => {
    assert.ok(!/[\r\n\0']/.test(value), `Unsupported character in production secret: ${key}`)
    return `${key}='${value}'`
  }).join("\n") + "\n"
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.ok(process.argv[2], "Pass the environment file destination")
  await writeFile(process.argv[2], renderEnvironment(process.env), { mode: 0o600, flag: "wx" })
  if (!process.env.AUTH_DISCORD_ID) console.log("::warning::Discord login is not configured; add the three Discord production secrets.")
}
