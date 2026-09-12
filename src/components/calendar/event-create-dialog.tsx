"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createGuildEvent } from "@/lib/actions/calendar"
import {
  EVENT_COLORS,
  EVENT_TYPE_METADATA,
  type EventColorId,
  type GuildEventType,
} from "@/lib/calendar-types"
import { todayInWarsaw } from "@/lib/dates"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ChevronDown } from "lucide-react"

export function EventCreateDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialDate,
  initialStartTime,
  initialEndTime,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialDate?: string
  initialStartTime?: string
  initialEndTime?: string
} = {}) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (val: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(val)
    } else {
      setInternalOpen(val)
    }
  }

  const [pending, startTransition] = useTransition()

  const [type, setType] = useState<GuildEventType>("v3")
  const [color, setColor] = useState<EventColorId>(() => EVENT_TYPE_METADATA.v3.defaultColor)
  const [title, setTitle] = useState("V3")
  const [date, setDate] = useState(() => initialDate || todayInWarsaw())
  const [startTime, setStartTime] = useState(() => {
    if (initialStartTime) return initialStartTime
    const now = new Date()
    const h = String(now.getHours() + 1).padStart(2, "0")
    return `${h}:00`
  })
  const [endTime, setEndTime] = useState(() => {
    if (initialEndTime) return initialEndTime
    const now = new Date()
    const h = String((now.getHours() + 4) % 24).padStart(2, "0")
    return `${h}:00`
  })
  const [selectedDays, setSelectedDays] = useState<number[]>([]) // 1 = Pon, ..., 7 = Niedz
  const [maxParticipants, setMaxParticipants] = useState<number | "">("")
  const [description, setDescription] = useState("")

  // Update values if initial props change while opening
  const prevInitialRef = useState({ initialDate, initialStartTime, initialEndTime })
  if (
    prevInitialRef[0].initialDate !== initialDate ||
    prevInitialRef[0].initialStartTime !== initialStartTime ||
    prevInitialRef[0].initialEndTime !== initialEndTime
  ) {
    prevInitialRef[1]({ initialDate, initialStartTime, initialEndTime })
    if (initialDate) setDate(initialDate)
    if (initialStartTime) setStartTime(initialStartTime)
    if (initialEndTime) setEndTime(initialEndTime)
  }

  const DAYS_OF_WEEK = [
    { id: 1, label: "Pn" },
    { id: 2, label: "Wt" },
    { id: 3, label: "Śr" },
    { id: 4, label: "Cz" },
    { id: 5, label: "Pt" },
    { id: 6, label: "Sb" },
    { id: 7, label: "Nd" },
  ] as const

  function toggleDay(dayId: number) {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    )
  }

  function handleTypeChange(newType: GuildEventType) {
    setType(newType)
    setColor(EVENT_TYPE_METADATA[newType].defaultColor)

    switch (newType) {
      case "v3":
        setTitle("V3")
        break
      case "red_las":
        setTitle("Red Las")
        break
      case "dungeon":
        setTitle("Dungeon")
        break
      case "other":
      default:
        setTitle("Wydarzenie")
        break
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createGuildEvent({
        title,
        type,
        color,
        date,
        startTime,
        endTime,
        recurringDays: selectedDays.length > 0 ? selectedDays : undefined,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        description,
      })

      if (!res.ok) {
        toast.error(res.error)
        return
      }

      toast.success(res.message)
      setOpen(false)
      router.refresh()
    })
  }

  const meta = EVENT_TYPE_METADATA[type]
  const isPartyMode = meta.mode === "party"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled ? <DialogTrigger render={<Button>+ Zaplanuj wydarzenie</Button>} /> : null}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nowe wydarzenie</DialogTitle>
            <DialogDescription>
              Wypełnij szczegóły i wybierz ewentualne dni powtarzania.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="event-type">Kategoria</FieldLabel>
              <div className="relative">
                <select
                  id="event-type"
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value as GuildEventType)}
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer [color-scheme:light] dark:[color-scheme:dark] dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {Object.entries(EVENT_TYPE_METADATA).map(([k, v]) => (
                    <option
                      key={k}
                      value={k}
                      className="bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100 py-2"
                    >
                      {v.icon} {v.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <ChevronDown className="size-4 opacity-70" />
                </div>
              </div>
            </Field>

            <Field>
              <FieldLabel>Kolor</FieldLabel>
              <div className="flex items-center gap-2.5 pt-0.5">
                {Object.entries(EVENT_COLORS).map(([cKey, cVal]) => {
                  const isSelected = color === cKey
                  return (
                    <button
                      key={cKey}
                      type="button"
                      onClick={() => setColor(cKey as EventColorId)}
                      title={cVal.label}
                      className={`h-7 w-7 rounded-full transition-transform flex items-center justify-center relative shadow-xs ${cVal.dotClass} ${
                        isSelected
                          ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                          : "hover:scale-105 opacity-90 hover:opacity-100"
                      }`}
                    >
                      {isSelected ? (
                        <span className="h-2 w-2 rounded-full bg-white shadow-xs" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="event-title">Nazwa</FieldLabel>
              <Input
                id="event-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Wieczorne V3 lub Wyprawa na Smoka"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="event-date">Data</FieldLabel>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="event-start">Start</FieldLabel>
                <Input
                  id="event-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="event-end">Koniec</FieldLabel>
                <Input
                  id="event-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel>Cykliczność (dni tygodnia)</FieldLabel>
                {selectedDays.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedDays([])}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    Resetuj
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Jednorazowe</span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = selectedDays.includes(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={`h-9 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                      }`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            {isPartyMode ? (
              <Field>
                <FieldLabel htmlFor="event-max">Limit miejsc</FieldLabel>
                <Input
                  id="event-max"
                  type="number"
                  min={1}
                  max={100}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="np. 8 dla pełnego party"
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="event-desc">Opis</FieldLabel>
              <Input
                id="event-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="np. Wymagane przepustki i buff smok"
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Utwórz wydarzenie
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
