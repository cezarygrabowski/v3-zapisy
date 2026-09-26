import { positionLabel, slotLabel, type PositionId, type SlotId } from "@/lib/constants"
import { formatDatePl } from "@/lib/dates"
import type { WeekEntry } from "@/lib/fees"

export function entryWord(count: number): string {
  if (count === 1) return "wejście"
  if (count >= 2 && count <= 4) return "wejścia"
  return "wejść"
}

export function WeekEntries({ entries }: { entries: WeekEntry[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
      {entries.map((entry, idx) => (
        <li key={`${entry.date}-${entry.slot}-${entry.position}-${idx}`}>
          {formatDatePl(entry.date)} · {slotLabel(entry.slot as SlotId)} ·{" "}
          {positionLabel(entry.position as PositionId)} ·{" "}
          {entry.feeWaived || entry.feeKk === 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              0 kk{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({entry.feeWaivedReason ? `zniesiona: ${entry.feeWaivedReason}` : "składka zniesiona: wróg na V3"})
              </span>
            </span>
          ) : (
            `${entry.feeKk} kk`
          )}
        </li>
      ))}
    </ul>
  )
}
