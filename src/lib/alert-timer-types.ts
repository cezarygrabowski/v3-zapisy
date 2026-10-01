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
