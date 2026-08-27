import { mkdir } from "node:fs/promises"
import path from "node:path"
import { sql } from "drizzle-orm"
import * as schema from "@/lib/db/schema"

type AppDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
} & ReturnType<typeof import("drizzle-orm/pglite").drizzle<typeof schema>>

const globalForDb = globalThis as unknown as {
  dbPromise?: Promise<AppDb>
}

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      discord_id text UNIQUE,
      discord_name text NOT NULL,
      game_nick text NOT NULL,
      login text UNIQUE,
      password_hash text,
      playstyle text,
      is_leader boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `ALTER TABLE users ALTER COLUMN discord_id DROP NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS login text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique ON users (login)`,
  `CREATE TABLE IF NOT EXISTS signups (
      id text PRIMARY KEY,
      date text NOT NULL,
      slot text NOT NULL,
      position text NOT NULL,
      user_id text NOT NULL REFERENCES users(id),
      fee_kk integer NOT NULL,
      paid boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT signups_slot_unique UNIQUE (date, slot, position),
      CONSTRAINT signups_user_day_unique UNIQUE (date, user_id)
    )`,
  `CREATE TABLE IF NOT EXISTS run_kills (
      id text PRIMARY KEY,
      kind text NOT NULL,
      reported_by text NOT NULL REFERENCES users(id),
      killed_at timestamptz NOT NULL DEFAULT now(),
      killed_at_label text NOT NULL,
      date text NOT NULL,
      slot text
    )`,
  `CREATE TABLE IF NOT EXISTS run_kill_helpers (
      kill_id text NOT NULL REFERENCES run_kills(id),
      user_id text NOT NULL REFERENCES users(id),
      CONSTRAINT run_kill_helpers_unique UNIQUE (kill_id, user_id)
    )`,
  `CREATE TABLE IF NOT EXISTS run_syncs (
      kind text PRIMARY KEY,
      synced_at timestamptz NOT NULL,
      synced_at_label text NOT NULL,
      updated_by text NOT NULL REFERENCES users(id)
    )`,
  `CREATE TABLE IF NOT EXISTS fee_payments (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id),
      amount_kk integer NOT NULL,
      status text NOT NULL,
      reported_by text NOT NULL REFERENCES users(id),
      confirmed_by text REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz
    )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_one_pending
      ON fee_payments (user_id) WHERE status = 'pending'`,
]

async function ensureSchema(db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) {
  for (const statement of SCHEMA_SQL) {
    await db.execute(sql.raw(statement))
  }
}

async function createDb(): Promise<AppDb> {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl) {
    const { neon } = await import("@neondatabase/serverless")
    const { drizzle } = await import("drizzle-orm/neon-http")
    const db = drizzle(neon(databaseUrl), { schema })
    await ensureSchema(db)
    return db as unknown as AppDb
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production (Neon Postgres).")
  }

  const { PGlite } = await import("@electric-sql/pglite")
  const { drizzle } = await import("drizzle-orm/pglite")
  const dataDir = path.join(process.cwd(), "data")
  await mkdir(dataDir, { recursive: true })
  const client = new PGlite(path.join(dataDir, "v3"))
  await client.waitReady
  const db = drizzle({ client, schema }) as unknown as AppDb
  await ensureSchema(db)
  return db
}

export async function getDb(): Promise<AppDb> {
  if (!globalForDb.dbPromise) {
    globalForDb.dbPromise = createDb().catch((error) => {
      globalForDb.dbPromise = undefined
      throw error
    })
  }
  return globalForDb.dbPromise
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const withCode = error as { code?: string; cause?: { code?: string } }
  return withCode.code === "23505" || withCode.cause?.code === "23505"
}
