import assert from "node:assert/strict"
import pg from "pg"

// Run on the VPS after the deploy that adds is_super_admin:
//   cd /srv/v3-zapisy/current && node --env-file=/srv/v3-zapisy/shared/.env scripts/set-super-admin.mjs cez11
const discordName = process.argv[2]?.trim()
assert.ok(discordName, "Usage: node scripts/set-super-admin.mjs <discord name>")
assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required")
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  const column = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_super_admin'",
  )
  assert.equal(column.rows.length, 1, "users.is_super_admin is missing: deploy the guilds release first")
  const matches = await client.query(
    "SELECT id, game_nick FROM users WHERE discord_name = $1 AND deleted_at IS NULL",
    [discordName],
  )
  // A discord name is not unique, so never guess between several accounts.
  assert.equal(matches.rows.length, 1, `Expected exactly one account named ${discordName}, found ${matches.rows.length}`)
  const [user] = matches.rows
  await client.query("UPDATE users SET is_super_admin = true, is_leader = true WHERE id = $1", [user.id])
  const check = await client.query("SELECT is_super_admin, is_leader FROM users WHERE id = $1", [user.id])
  assert.deepEqual(check.rows[0], { is_super_admin: true, is_leader: true })
  console.log(`Super admin: ${discordName} (${user.game_nick}, ${user.id}) verified.`)
} finally {
  await client.end()
}
