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
      {entries.map((entry) => (
        <li key={`${entry.date}-${entry.slot}-${entry.position}`}>
          {formatDatePl(entry.date)} · {slotLabel(entry.slot as SlotId)} ·{" "}
          {positionLabel(entry.position as PositionId)} · {entry.feeKk} kk
        </li>
      ))}
    </ul>
  )
}
