import { type SlotId } from "@/lib/constants"

const TIME_ZONE = "Europe/Warsaw"

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value ?? ""
}

export function todayInWarsaw(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`
}

export function warsawMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  return Number(part(parts, "hour")) * 60 + Number(part(parts, "minute"))
}

export function isHms(value: string): boolean {
  return /^\d{2}:\d{2}:\d{2}$/.test(value)
}

export function warsawWallToDate(isoDate: string, hms: string): Date | null {
  if (!isIsoDate(isoDate) || !isHms(hms)) return null
  const utcGuess = new Date(`${isoDate}T${hms}Z`)
  if (Number.isNaN(utcGuess.getTime())) return null
  const shown = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(shown.find((item) => item.type === type)?.value ?? "0")
  const asShown = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  )
  return new Date(utcGuess.getTime() - (asShown - utcGuess.getTime()))
}

export function formatTimeWarsaw(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  return `${part(parts, "hour")}:${part(parts, "minute")}:${part(parts, "second")}`
}

export function currentSlotId(now = new Date()): SlotId | null {
  const minutes = warsawMinutes(now)
  for (const slot of [
    { id: "08:30" as const, start: 8 * 60 + 30 },
    { id: "11:30" as const, start: 11 * 60 + 30 },
    { id: "14:30" as const, start: 14 * 60 + 30 },
    { id: "17:30" as const, start: 17 * 60 + 30 },
  ]) {
    if (minutes >= slot.start && minutes < slot.start + 180) return slot.id
  }
  return null
}

export function relevantSlot(now = new Date()): {
  id: SlotId
  status: "trwa" | "nastepny" | "skonczony"
} {
  const current = currentSlotId(now)
  if (current) return { id: current, status: "trwa" }
  const minutes = warsawMinutes(now)
  for (const slot of [
    { id: "08:30" as const, start: 8 * 60 + 30 },
    { id: "11:30" as const, start: 11 * 60 + 30 },
    { id: "14:30" as const, start: 14 * 60 + 30 },
    { id: "17:30" as const, start: 17 * 60 + 30 },
  ]) {
    if (minutes < slot.start) return { id: slot.id, status: "nastepny" }
  }
  return { id: "17:30", status: "skonczony" }
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const utc = Date.UTC(year, month - 1, day)
  const dt = new Date(utc)
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  )
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function slotHasStarted(date: string, slot: SlotId, now = new Date()): boolean {
  const today = todayInWarsaw(now)
  if (date < today) return true
  if (date > today) return false
  const [hour, minute] = slot.split(":").map(Number)
  return warsawMinutes(now) >= hour * 60 + minute
}

export function weekStartForDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  return addDays(isoDate, diff)
}

export function weekEndForStart(weekStart: string): string {
  return addDays(weekStart, 6)
}

export function weekStartInWarsaw(now = new Date()): string {
  return weekStartForDate(todayInWarsaw(now))
}

export function formatWeekRangePl(weekStart: string): string {
  const weekEnd = weekEndForStart(weekStart)
  const start = utcNoon(weekStart)
  const end = utcNoon(weekEnd)
  const startMonth = monthShortPl(start)
  const endMonth = monthShortPl(end)
  const startYear = start.getUTCFullYear()
  const endYear = end.getUTCFullYear()
  if (startYear !== endYear) {
    return `${start.getUTCDate()} ${startMonth} ${startYear} – ${end.getUTCDate()} ${endMonth} ${endYear}`
  }
  if (startMonth !== endMonth) {
    return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth}`
  }
  return `${start.getUTCDate()}–${end.getUTCDate()} ${startMonth}`
}

function utcNoon(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function monthShortPl(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "")
}

export function formatRelativePl(iso: string | Date, now = new Date()): string {
  const then = typeof iso === "string" ? new Date(iso) : iso
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000))
  if (seconds < 45) return "przed chwilą"
  if (seconds < 90) return "minutę temu"
  if (seconds < 3600) return `${Math.round(seconds / 60)} min temu`
  if (seconds < 5400) return "godzinę temu"
  if (seconds < 86400) return `${Math.round(seconds / 3600)} godz. temu`
  const days = Math.round(seconds / 86400)
  if (days === 1) return "wczoraj"
  if (days < 7) return `${days} dni temu`
  return formatDatePl(todayInWarsaw(then))
}

export function monthStartInWarsaw(now = new Date()): string {
  return `${todayInWarsaw(now).slice(0, 7)}-01`
}

export function formatDatePl(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}
