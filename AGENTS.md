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
2. **Execute Immediately on Target Remote DB (Neon)**:
   - Automated unit tests (`npm test`) run on isolated in-memory PGlite, which creates fresh tables on the fly. Passing unit tests DOES NOT mean the remote Neon database has the new tables!
   - You MUST run a migration script directly against the real Neon database using `--env-file=.env.local` to ensure the DDL statements execute on Neon.
   - Verify the table exists by querying `information_schema.tables`.
3. **Restart the Next.js Dev Server**:
   - Next.js and Turbopack cache database connection pools in `globalThis`.
   - If `next dev` is running as a background task, you MUST restart it so it connects with the updated schema and drops stale cached instances.
4. **Zero Assumptions**:
   - Never consider a database task complete until step 2 (remote DB verification) and step 3 (dev server restart) have succeeded.
