import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import pg from "pg"

// Run: node --env-file=.env.local scripts/migrate-personal-timers.mjs
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
assert.ok(url, "DATABASE_URL is required")
const client = new pg.Client({ connectionString: url.replace("-pooler.", ".") })
const source = await readFile(new URL("../src/lib/db/index.ts", import.meta.url), "utf8")
const statements = [...source.matchAll(/`([^`]+)`/g)].map((match) => match[1])
  .filter((statement) => /^CREATE (TABLE IF NOT EXISTS personal_timers|INDEX IF NOT EXISTS personal_timers_user_id_idx)/.test(statement))
assert.equal(statements.length, 2, "Expected table and index DDL from SCHEMA_SQL")
await client.connect()
try {
  for (const statement of statements) await client.query(statement)
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'personal_timers'")
  assert.equal(tables.rows.length, 1, "personal_timers table is missing")
  const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'personal_timers'")
  assert.equal(columns.rows.length, 7, "personal_timers schema is incomplete")
  console.log("PostgreSQL: personal_timers table and its 7 columns verified.")
} finally {
  await client.end()
}
