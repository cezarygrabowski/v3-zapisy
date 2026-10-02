import test from "node:test"
import assert from "node:assert/strict"
import { parseEnv } from "node:util"
import { renderEnvironment } from "../../deploy/environment.mjs"

test("deployment environment preserves values and rejects missing or injected secrets", () => {
  const source = {
    DATABASE_URL: "postgres://user:password@127.0.0.1/elder_hub",
    AUTH_SECRET: 'dollar$hash#space ;double"backslash\\',
    CRON_SECRET: "cron-secret",
  }
  const values = parseEnv(renderEnvironment(source))
  for (const key of Object.keys(source)) assert.equal(values[key], source[key])
  assert.equal(values.DEV_LOGIN, "false")
  assert.equal(values.AUTH_URL, "https://elder-hub.pl")
  assert.equal(values.AUTH_DISCORD_ID, "")
  for (const key of Object.keys(source)) assert.throws(() => renderEnvironment({ ...source, [key]: "" }), /Missing production secret/)
  for (const invalid of ["line\nbreak", "line\rbreak", "null\0byte", "single'quote"]) {
    assert.throws(() => renderEnvironment({ ...source, AUTH_SECRET: invalid }), /Unsupported character/)
  }
  assert.throws(() => renderEnvironment({ ...source, DATABASE_URL: "https://example.com" }), /PostgreSQL/)
  assert.throws(() => renderEnvironment({ ...source, DATABASE_URL: "not-a-url" }), /valid PostgreSQL connection string/)
  assert.throws(() => renderEnvironment({ ...source, AUTH_DISCORD_ID: "client" }), /Missing Discord secret/)
  const configured = { ...source, AUTH_DISCORD_ID: "client", AUTH_DISCORD_SECRET: "secret", DISCORD_GUILD_ID: "guild" }
  assert.equal(parseEnv(renderEnvironment(configured)).DISCORD_GUILD_ID, "guild")
})
