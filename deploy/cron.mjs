const response = await fetch("http://127.0.0.1:3001/api/cron/discord", {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  signal: AbortSignal.timeout(60_000),
})
if (!response.ok) throw new Error(`Discord cron failed: HTTP ${response.status}`)
