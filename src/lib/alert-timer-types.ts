export type AlertTimer = {
  id: string
  name: string
  characterId: string | null
  characterName: string | null
  intervalMinutes: number
  lastCompletedAt: string | null
  readyAt: number
}

export type AlertTimerInput = {
  id?: string
  name: string
  characterId: string | null
  intervalMinutes: number
  startNow?: boolean
}

export function formatCountdown(readyAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((readyAt - now) / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor(seconds / 3600) % 24
  const minutes = Math.floor(seconds / 60) % 60
  return `${days ? `${days} d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

// Accepts what formatCountdown prints ("1 d 01:02:03", "01:02:03") plus "H:MM". Returns seconds or null.
export function parseCountdown(text: string): number | null {
  const match = text.trim().match(/^(?:(\d+)\s*d\s*)?(\d+):([0-5]\d)(?::([0-5]\d))?$/i)
  if (!match) return null
  const [, days = "0", hours, minutes, seconds = "0"] = match
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}
