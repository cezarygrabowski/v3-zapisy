import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { neon } from "@neondatabase/serverless"

// Run: node --env-file=.env.local scripts/migrate-personal-timers.mjs
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
assert.ok(url, "DATABASE_URL is required; this migration must run on Neon")
const sql = neon(url.replace("-pooler.", "."))
const source = await readFile(new URL("../src/lib/db/index.ts", import.meta.url), "utf8")
const statements = [...source.matchAll(/`([^`]+)`/g)].map((match) => match[1])
  .filter((statement) => /^CREATE (TABLE IF NOT EXISTS personal_timers|INDEX IF NOT EXISTS personal_timers_user_id_idx)/.test(statement))
assert.equal(statements.length, 2, "Expected table and index DDL from SCHEMA_SQL")
for (const statement of statements) await sql.query(statement)
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'personal_timers'`
assert.equal(tables.length, 1, "Remote personal_timers table is missing")
const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'personal_timers'`
assert.equal(columns.length, 7, "Remote personal_timers schema is incomplete")
console.log("Neon: personal_timers table and its 7 columns verified.")
