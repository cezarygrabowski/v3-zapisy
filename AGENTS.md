<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Database Schema & Migration Protocol (MANDATORY)

Every time ANY database change is made (new table, new column, altered relation, modified schema):
1. **Schema & Migration SQL**:
   - Update `src/lib/db/schema.ts` with Drizzle definitions.
   - Increment `SCHEMA_VERSION` in `src/lib/db/index.ts`.
   - Add the corresponding DDL statement (`CREATE TABLE IF NOT EXISTS...` or `ALTER TABLE... ADD COLUMN IF NOT EXISTS...`) to `SCHEMA_SQL` in `src/lib/db/index.ts`.
2. **Execute Immediately on Target Production DB (PostgreSQL)**:
   - Unit tests use isolated PGlite; the PostgreSQL integration test uses a dedicated `elder_hub_test` database. Passing tests DOES NOT mean the production database has the new tables!
   - Production is `elder_hub` on OVH VPS `57.131.43.47`, accessed by the application through `127.0.0.1:5432`. Neon is a frozen archive and must not receive application writes.
   - Run migration scripts against `elder_hub` using `/srv/v3-zapisy/shared/.env`, then verify the DDL executed. This file points to the active release. GitHub's `production` environment secrets own the runtime configuration; update its `DATABASE_URL` when changing the connection. Do not use development `.env.local` credentials for production migrations.
   - Verify the table exists by querying `information_schema.tables`.
3. **Restart the Next.js Dev Server**:
   - Next.js and Turbopack cache database connection pools in `globalThis`.
   - If `next dev` is running as a background task, you MUST restart it so it connects with the updated schema and drops stale cached instances.
4. **Zero Assumptions**:
   - Never consider a database task complete until step 2 (remote DB verification) and step 3 (dev server restart) have succeeded.

# Production Deployment Verification Protocol (OVH VPS)

When pushing changes to `main` or verifying production deployments:
1. Check `.github/workflows/deploy.yml` succeeded for the intended `main` commit.
2. On the VPS, verify `systemctl status v3-zapisy` and `curl --fail http://127.0.0.1:3001/api/health`.
3. Verify `https://elder-hub.pl/login` and `https://elder-hub.pl/api/health` publicly. Nginx terminates HTTPS and proxies to port 3001; do not expose the Node or database ports publicly.
4. `v3-zapisy-cron.timer` runs hourly; `v3-zapisy-backup.timer` creates a daily PostgreSQL backup with 14-day retention.

Legacy Vercel project `elder-hub` (team `fob5`) is paused and disconnected from
GitHub. Its `elder-hub.vercel.app` and `v3-zapisy.vercel.app` aliases return 503
intentionally. Do not resume the old Vercel application or Neon writes after
the database cutover: that would split production data between two databases.
