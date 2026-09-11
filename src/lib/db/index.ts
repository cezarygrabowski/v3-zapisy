import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { sql } from "drizzle-orm"
import * as schema from "@/lib/db/schema"

type AppDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
} & ReturnType<typeof import("drizzle-orm/pglite").drizzle<typeof schema>>

const SCHEMA_VERSION = 7

const globalForDb = globalThis as unknown as {
  dbPromise?: Promise<AppDb>
  schemaVersion?: number
  schemaPromise?: Promise<void>
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
      is_verified boolean NOT NULL DEFAULT false,
      roles text NOT NULL DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `ALTER TABLE users ALTER COLUMN discord_id DROP NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS login text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS roles text NOT NULL DEFAULT '[]'`,
  `UPDATE users SET is_verified = true WHERE is_leader = true OR is_verified IS NULL`,
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
  `CREATE TABLE IF NOT EXISTS red_expeditions (
      id text PRIMARY KEY,
      title text NOT NULL,
      spot text NOT NULL DEFAULT 'boss',
      date text NOT NULL,
      start_time text NOT NULL,
      duration_hours integer NOT NULL DEFAULT 3,
      respawn_minutes integer NOT NULL DEFAULT 50,
      respawn_min_minutes integer NOT NULL DEFAULT 48,
      respawn_max_minutes integer NOT NULL DEFAULT 52,
      status text NOT NULL DEFAULT 'planned',
      notes text,
      created_by text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `ALTER TABLE red_expeditions ADD COLUMN IF NOT EXISTS spot text NOT NULL DEFAULT 'boss'`,
  `ALTER TABLE red_expeditions ADD COLUMN IF NOT EXISTS respawn_min_minutes integer NOT NULL DEFAULT 48`,
  `ALTER TABLE red_expeditions ADD COLUMN IF NOT EXISTS respawn_max_minutes integer NOT NULL DEFAULT 52`,
  `CREATE TABLE IF NOT EXISTS red_expedition_signups (
      id text PRIMARY KEY,
      expedition_id text NOT NULL REFERENCES red_expeditions(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id),
      hour_index integer NOT NULL,
      attended boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT red_expedition_signups_unique UNIQUE (expedition_id, user_id, hour_index)
    )`,
  `CREATE TABLE IF NOT EXISTS red_boss_kills (
      id text PRIMARY KEY,
      expedition_id text REFERENCES red_expeditions(id) ON DELETE SET NULL,
      channel integer NOT NULL,
      reported_by text NOT NULL REFERENCES users(id),
      killed_at timestamptz NOT NULL DEFAULT now(),
      killed_at_label text NOT NULL,
      date text NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS red_shop_items (
      id text PRIMARY KEY,
      week_start text NOT NULL,
      expedition_id text REFERENCES red_expeditions(id) ON DELETE SET NULL,
      name text NOT NULL,
      quantity integer NOT NULL DEFAULT 1,
      price_won integer NOT NULL DEFAULT 0,
      price_kk integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'listed',
      sold_price_won integer,
      sold_price_kk integer,
      added_by text NOT NULL REFERENCES users(id),
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      sold_at timestamptz
    )`,
  `CREATE TABLE IF NOT EXISTS red_payouts (
      id text PRIMARY KEY,
      week_start text NOT NULL,
      user_id text NOT NULL REFERENCES users(id),
      is_paid boolean NOT NULL DEFAULT false,
      paid_at timestamptz,
      paid_by text REFERENCES users(id),
      CONSTRAINT red_payouts_week_user_unique UNIQUE (week_start, user_id)
    )`,
  `CREATE TABLE IF NOT EXISTS timer_categories (
      id text PRIMARY KEY,
      name text NOT NULL,
      icon text NOT NULL DEFAULT '🗺️',
      order_index integer NOT NULL DEFAULT 0,
      created_by text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS custom_timers (
      id text PRIMARY KEY,
      category_id text NOT NULL REFERENCES timer_categories(id) ON DELETE CASCADE,
      name text NOT NULL,
      channels_count integer NOT NULL DEFAULT 5,
      respawn_min_minutes integer NOT NULL DEFAULT 48,
      respawn_max_minutes integer NOT NULL DEFAULT 52,
      notes text,
      created_by text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS custom_timer_kills (
      id text PRIMARY KEY,
      timer_id text NOT NULL REFERENCES custom_timers(id) ON DELETE CASCADE,
      channel integer NOT NULL,
      killed_at timestamptz NOT NULL DEFAULT now(),
      killed_at_label text NOT NULL,
      reported_by text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS guild_events (
      id text PRIMARY KEY,
      title text NOT NULL,
      type text NOT NULL DEFAULT 'v3',
      date text NOT NULL,
      start_time text NOT NULL,
      end_time text,
      duration_hours integer NOT NULL DEFAULT 3,
      signup_mode text NOT NULL DEFAULT 'spots',
      recurrence text NOT NULL DEFAULT 'none',
      max_participants integer,
      description text,
      status text NOT NULL DEFAULT 'planned',
      created_by text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS end_time text`,
  `ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none'`,
  `ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue'`,
  `CREATE TABLE IF NOT EXISTS guild_event_signups (
      id text PRIMARY KEY,
      event_id text NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id),
      hour_index integer NOT NULL DEFAULT 0,
      spot text,
      role text,
      attended boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `ALTER TABLE guild_event_signups ADD COLUMN IF NOT EXISTS spot text`,
  `CREATE TABLE IF NOT EXISTS guild_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text REFERENCES users(id)
    )`,
  `CREATE TABLE IF NOT EXISTS guild_event_audit_logs (
      id text PRIMARY KEY,
      event_id text NOT NULL REFERENCES guild_events(id) ON DELETE CASCADE,
      action text NOT NULL,
      actor_id text NOT NULL REFERENCES users(id),
      target_user_id text REFERENCES users(id),
      spot text,
      role text,
      reason text,
      details text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS user_penalties (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_id text NOT NULL REFERENCES users(id),
      event_id text REFERENCES guild_events(id) ON DELETE SET NULL,
      reason text NOT NULL,
      card_level integer NOT NULL DEFAULT 1,
      duration_days integer NOT NULL,
      issued_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      revoked_by text REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `CREATE TABLE IF NOT EXISTS user_characters (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL UNIQUE,
      playstyle text NOT NULL DEFAULT 'pvm',
      is_main boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
  `ALTER TABLE guild_event_signups ADD COLUMN IF NOT EXISTS character_id text REFERENCES user_characters(id) ON DELETE SET NULL`,
  `ALTER TABLE guild_event_signups ADD COLUMN IF NOT EXISTS character_name text`,
  `INSERT INTO user_characters (id, user_id, name, playstyle, is_main, created_at)
      SELECT id, id, game_nick, COALESCE(playstyle, 'pvm'), true, now()
      FROM users
      WHERE id NOT IN (SELECT user_id FROM user_characters)
      ON CONFLICT DO NOTHING`,
]

async function ensureSchema(db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) {
  for (const statement of SCHEMA_SQL) {
    try {
      await db.execute(sql.raw(statement))
    } catch (error) {
      console.warn("[db] Schema statement notice:", (error as Error)?.message || error)
    }
  }
}

async function createDb(): Promise<AppDb> {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl) {
    const { neon } = await import("@neondatabase/serverless")
    const { drizzle } = await import("drizzle-orm/neon-http")
    const db = drizzle(neon(databaseUrl), { schema })
    await ensureSchema(db)
    globalForDb.schemaVersion = SCHEMA_VERSION
    return db as unknown as AppDb
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production (Neon Postgres).")
  }

  const { PGlite } = await import("@electric-sql/pglite")
  const { drizzle } = await import("drizzle-orm/pglite")
  const dataDir = path.join(process.cwd(), "data")
  await mkdir(dataDir, { recursive: true })
  const pidFile = path.join(dataDir, "v3", "postmaster.pid")
  try {
    await rm(pidFile, { force: true })
  } catch {}
  const client = new PGlite(path.join(dataDir, "v3"))
  await client.waitReady
  const db = drizzle({ client, schema }) as unknown as AppDb
  await ensureSchema(db)
  globalForDb.schemaVersion = SCHEMA_VERSION
  return db
}

export async function getDb(): Promise<AppDb> {
  if (!globalForDb.dbPromise) {
    globalForDb.dbPromise = createDb().catch((error) => {
      globalForDb.dbPromise = undefined
      throw error
    })
  }

  const db = await globalForDb.dbPromise

  // Ensure latest schema has run even if dbPromise was cached on globalThis across HMR
  if (globalForDb.schemaVersion !== SCHEMA_VERSION) {
    if (!globalForDb.schemaPromise) {
      globalForDb.schemaPromise = ensureSchema(db)
        .then(() => {
          globalForDb.schemaVersion = SCHEMA_VERSION
        })
        .finally(() => {
          globalForDb.schemaPromise = undefined
        })
    }
    await globalForDb.schemaPromise
  }

  return db
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const withCode = error as { code?: string; cause?: { code?: string } }
  return withCode.code === "23505" || withCode.cause?.code === "23505"
}
