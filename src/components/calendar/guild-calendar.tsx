"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { rescheduleGuildEvent } from "@/lib/actions/calendar"
import {
  calculateDurationHours,
  EVENT_TYPE_METADATA,
  getEventColorPreset,
  type GuildEventListItem,
  type GuildEventType,
} from "@/lib/calendar-types"
import {
  addDays,
  formatDatePl,
  formatWeekRangePl,
  todayInWarsaw,
  weekStartInWarsaw,
  weekStartForDate,
} from "@/lib/dates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EventCreateDialog } from "./event-create-dialog"
import { EventDetailDialog } from "./event-detail-dialog"

export function GuildCalendar({
  events,
  currentUserId = "",
  isLeader = false,
  isAdmin = false,
  allGuildUsers = [],
  initialEventId,
}: {
  events: GuildEventListItem[]
  currentUserId?: string
  isLeader?: boolean
  isAdmin?: boolean
  allGuildUsers?: { id: string; gameNick: string }[]
  initialEventId?: string
}) {
  const userIsAdmin = Boolean(isAdmin || isLeader)
  const router = useRouter()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId ?? null)
  const [selectedType, setSelectedType] = useState<string>("all")
  const [showOnlyMine, setShowOnlyMine] = useState(false)
  const [viewMode, setViewMode] = useState<"week" | "month" | "agenda">("week")

  const handleSelectEvent = useCallback((id: string | null) => {
    setSelectedEventId(id)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      if (id) {
        url.searchParams.set("wydarzenie", id)
      } else {
        url.searchParams.delete("wydarzenie")
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}`)
    }
  }, [])

  const today = todayInWarsaw()

  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    if (initialEventId) {
      const match = events.find((e) => e.id === initialEventId)
      if (match) {
        return weekStartForDate(match.date)
      }
    }
    return weekStartInWarsaw()
  })

  // Month navigation state
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())

  // Filter events
  const myEventsCount = events.filter((e) => Boolean(e.mySignup)).length

  const filteredEvents = events.filter((e) => {
    if (showOnlyMine && !e.mySignup) return false
    if (selectedType !== "all" && e.type !== selectedType) return false
    return true
  })

  // Group events by date (YYYY-MM-DD)
  const eventsByDate = new Map<string, GuildEventListItem[]>()
  for (const e of filteredEvents) {
    const list = eventsByDate.get(e.date) ?? []
    list.push(e)
    eventsByDate.set(e.date, list)
  }

  // Week days calculation
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const dateStr = addDays(currentWeekStart, offset)
    const dayNamesPl = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]
    const [year, month, day] = dateStr.split("-").map(Number)
    const dateObj = new Date(Date.UTC(year, month - 1, day))
    const dayDateFormatted = new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(dateObj)

    return {
      date: dateStr,
      dayName: dayNamesPl[offset],
      dayDate: dayDateFormatted,
      dayEvents: eventsByDate.get(dateStr) ?? [],
      isToday: dateStr === today,
    }
  })

  // Drag-to-create state (Google Calendar style with 30-minute precision)
  const [dragState, setDragState] = useState<{
    date: string
    startOffset: number // in hours, e.g. 8.5 for 08:30
    endOffset: number // in hours, e.g. 11.5 for 11:30
    isDragging: boolean
  } | null>(null)

  // Dialog controlled state triggered by drag or button
  const [createModalState, setCreateModalState] = useState<{
    open: boolean
    date?: string
    startTime?: string
    endTime?: string
  }>({ open: false })

  const START_HOUR = 7
  const END_HOUR = 24 // up to 24:00 (00:00 midnight)
  const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const HOUR_HEIGHT = 60 // pixels per hour (30px per 30 min)

  function formatTimeOffset(offset: number): string {
    const totalMinutes = Math.round(offset * 60)
    const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
    const h = Math.floor(normalizedMinutes / 60)
    const m = normalizedMinutes % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }

  // Drag-to-move or drag-to-resize existing event
  const [eventDrag, setEventDrag] = useState<{
    mode: "move" | "resize"
    event: GuildEventListItem
    targetDate: string
    currentStartOffset: number
    currentEndOffset: number
    origDate: string
    origStartOffset: number
    origEndOffset: number
    startY: number
    startX: number
    hasMoved: boolean
  } | null>(null)

  const [rescheduling, setRescheduling] = useState(false)

  function handleMouseDownSlot(dateStr: string, slotOffset: number) {
    if (eventDrag) return
    setDragState({
      date: dateStr,
      startOffset: slotOffset,
      endOffset: Math.min(END_HOUR, slotOffset + 1), // default 1 hour block
      isDragging: true,
    })
  }

  function handleMouseEnterSlot(dateStr: string, slotOffset: number) {
    if (!dragState || !dragState.isDragging || dragState.date !== dateStr) return
    const minOff = Math.min(dragState.startOffset, slotOffset)
    const maxOff = Math.max(dragState.startOffset, slotOffset) + 0.5
    setDragState({
      date: dateStr,
      startOffset: minOff,
      endOffset: maxOff,
      isDragging: true,
    })
  }

  const finishEventDrag = useCallback(async (curDrag: NonNullable<typeof eventDrag>) => {
    setEventDrag(null)
    if (!curDrag.hasMoved) return

    const newStartStr = formatTimeOffset(curDrag.currentStartOffset)
    const newEndStr = formatTimeOffset(curDrag.currentEndOffset)
    const isSame =
      curDrag.targetDate === curDrag.origDate &&
      newStartStr === formatTimeOffset(curDrag.origStartOffset) &&
      newEndStr === formatTimeOffset(curDrag.origEndOffset)

    if (isSame) return

    setRescheduling(true)
    try {
      const res = await rescheduleGuildEvent({
        eventId: curDrag.event.id,
        date: curDrag.targetDate,
        startTime: newStartStr,
        endTime: newEndStr,
      })
      if (!res.ok) {
        toast.error(res.error || "Nie udało się zaktualizować terminu wydarzenia.")
      } else {
        toast.success(`Zaktualizowano termin: ${curDrag.targetDate} (${newStartStr} – ${newEndStr})`)
        router.refresh()
      }
    } catch {
      toast.error("Wystąpił błąd podczas aktualizacji terminu.")
    } finally {
      setRescheduling(false)
    }
  }, [router])

  function handleMouseUp() {
    if (eventDrag) {
      finishEventDrag(eventDrag)
    }
    if (dragState && dragState.isDragging) {
      setCreateModalState({
        open: true,
        date: dragState.date,
        startTime: formatTimeOffset(dragState.startOffset),
        endTime: formatTimeOffset(dragState.endOffset),
      })
    }
    setDragState(null)
  }

  // Global mouse move & mouse up listeners during event drag/resize
  useEffect(() => {
    if (!eventDrag) return

    function onMouseMove(e: MouseEvent) {
      setEventDrag((prev) => {
        if (!prev) return null
        const deltaY = e.clientY - prev.startY
        const deltaX = e.clientX - prev.startX

        // Check if movement exceeds threshold (6px in any direction)
        const hasMoved = prev.hasMoved || Math.abs(deltaY) > 6 || Math.abs(deltaX) > 6
        if (!hasMoved) {
          return prev
        }

        if (prev.mode === "resize") {
          // Resize in 30-minute (0.5h) increments, min duration 0.5h
          const resizeStepHours = Math.round(deltaY / (HOUR_HEIGHT / 2)) * 0.5
          const newEnd = Math.max(
            prev.origStartOffset + 0.5,
            Math.min(END_HOUR, prev.origEndOffset + resizeStepHours)
          )
          return {
            ...prev,
            currentEndOffset: newEnd,
            hasMoved: true,
          }
        } else {
          // move mode (supports 30-minute intervals)
          const moveStepHours = Math.round(deltaY / (HOUR_HEIGHT / 2)) * 0.5
          const duration = prev.origEndOffset - prev.origStartOffset
          let newStart = prev.origStartOffset + moveStepHours
          if (newStart < START_HOUR) newStart = START_HOUR
          if (newStart + duration > END_HOUR) newStart = END_HOUR - duration
          const newEnd = newStart + duration

          return {
            ...prev,
            currentStartOffset: newStart,
            currentEndOffset: newEnd,
            hasMoved: true,
          }
        }
      })
    }

    function onMouseUpGlobal() {
      setEventDrag((cur) => {
        if (cur) {
          if (cur.hasMoved) {
            finishEventDrag(cur)
          } else {
            // Normal click without movement: open modal!
            handleSelectEvent(cur.event.id)
          }
        }
        return null
      })
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUpGlobal)

    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUpGlobal)
    }
  }, [eventDrag, finishEventDrag])

  // Helper to parse HH:MM into float hours for vertical positioning
  function parseTimeToOffset(timeStr: string): number {
    const [h, m] = timeStr.split(":").map(Number)
    return (h || 0) + (m || 0) / 60
  }

  // Compute parallel columns for overlapping events (Google Calendar layout)
  function computeOverlappingLayout(dayEvents: GuildEventListItem[]) {
    if (dayEvents.length === 0) return new Map<string, { colIndex: number; totalCols: number }>()

    // Sort by start offset ascending, then by duration descending
    const items = dayEvents.map((evt) => {
      const start = parseTimeToOffset(evt.startTime)
      const duration = evt.endTime ? calculateDurationHours(evt.startTime, evt.endTime) : (evt.durationHours || 1)
      const end = start + duration
      return { id: evt.id, start, end }
    }).sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))

    // Group items into connected clusters of overlapping events
    const clusters: typeof items[] = []
    let currentCluster: typeof items = []
    let clusterEnd = -1

    for (const item of items) {
      if (currentCluster.length === 0 || item.start < clusterEnd) {
        currentCluster.push(item)
        clusterEnd = Math.max(clusterEnd, item.end)
      } else {
        clusters.push(currentCluster)
        currentCluster = [item]
        clusterEnd = item.end
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster)
    }

    const layout = new Map<string, { colIndex: number; totalCols: number }>()

    for (const cluster of clusters) {
      const columns: typeof items[] = []
      for (const item of cluster) {
        let placed = false
        for (let c = 0; c < columns.length; c++) {
          const lastInCol = columns[c][columns[c].length - 1]
          if (lastInCol.end <= item.start) {
            columns[c].push(item)
            layout.set(item.id, { colIndex: c, totalCols: 0 }) // totalCols updated below
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([item])
          layout.set(item.id, { colIndex: columns.length - 1, totalCols: 0 })
        }
      }
      const totalCols = columns.length
      for (const item of cluster) {
        const entry = layout.get(item.id)
        if (entry) entry.totalCols = totalCols
      }
    }

    return layout
  }

  function handlePrevWeek() {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  function handleNextWeek() {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  function handleTodayWeek() {
    setCurrentWeekStart(weekStartInWarsaw())
  }

  // Month calculation
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7

  const monthNamesPl = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
  ]
  const weekDaysShortPl = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"]

  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <span>Kalendarz Wydarzeń Gildijnych</span>
            <Badge variant="secondary" className="text-xs">
              {filteredEvents.length} wydarzeń
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Przeglądaj zaplanowane akcje (V3, Red Las, Smok, Wojny) w widoku tygodniowym i dołączaj do party.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <EventCreateDialog />
          {createModalState.open ? (
            <EventCreateDialog
              open={createModalState.open}
              onOpenChange={(open) => setCreateModalState((prev) => ({ ...prev, open }))}
              initialDate={createModalState.date}
              initialStartTime={createModalState.startTime}
              initialEndTime={createModalState.endTime}
            />
          ) : null}
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        {/* Category selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="xs"
            variant={selectedType === "all" && !showOnlyMine ? "default" : "outline"}
            className="rounded-full text-xs shrink-0"
            onClick={() => {
              setSelectedType("all")
              setShowOnlyMine(false)
            }}
          >
            Wszystkie ({events.length})
          </Button>

          <Button
            size="xs"
            variant={showOnlyMine ? "default" : "outline"}
            className={`rounded-full text-xs shrink-0 gap-1.5 font-medium ${
              showOnlyMine
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
            onClick={() => setShowOnlyMine((prev) => !prev)}
          >
            <span>✓</span>
            <span>Moje zapisy</span>
            <span className="text-[10px] opacity-80 font-mono">({myEventsCount})</span>
          </Button>
          {(Object.keys(EVENT_TYPE_METADATA) as GuildEventType[]).map((typeKey) => {
            const meta = EVENT_TYPE_METADATA[typeKey]
            const count = events.filter((e) => e.type === typeKey).length
            return (
              <Button
                key={typeKey}
                size="xs"
                variant={selectedType === typeKey ? "default" : "outline"}
                className="rounded-full text-xs shrink-0 gap-1"
                onClick={() => setSelectedType(typeKey)}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </Button>
            )
          })}
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <Button
            size="xs"
            variant={viewMode === "week" ? "secondary" : "ghost"}
            className="text-xs h-8 font-medium"
            onClick={() => setViewMode("week")}
          >
            📅 Tydzień
          </Button>
          <Button
            size="xs"
            variant={viewMode === "month" ? "secondary" : "ghost"}
            className="text-xs h-8 font-medium"
            onClick={() => setViewMode("month")}
          >
            🗓️ Miesiąc
          </Button>
          <Button
            size="xs"
            variant={viewMode === "agenda" ? "secondary" : "ghost"}
            className="text-xs h-8 font-medium"
            onClick={() => setViewMode("agenda")}
          >
            📋 Lista
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. WEEKLY VIEW (DEFAULT)                                                  */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. WEEKLY VIEW (GOOGLE CALENDAR HOURLY TIMETABLE WITH DRAG-TO-CREATE)      */}
      {/* ========================================================================= */}
      {viewMode === "week" ? (
        <div className="flex flex-col gap-3">
          {/* Week navigation bar */}
          <div className="flex items-center justify-between bg-card border rounded-xl p-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="font-heading font-bold text-base">
                Tydzień: {formatWeekRangePl(currentWeekStart)}
              </span>
              <span className="hidden sm:inline text-xs text-muted-foreground">
                (Kliknij i przeciągnij w siatce, aby dodać wydarzenie)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="outline" className="h-7 w-7 p-0" onClick={handlePrevWeek}>
                ‹
              </Button>
              <Button size="xs" variant="ghost" className="h-7 text-xs px-2.5" onClick={handleTodayWeek}>
                Bieżący tydzień
              </Button>
              <Button size="xs" variant="outline" className="h-7 w-7 p-0" onClick={handleNextWeek}>
                ›
              </Button>
            </div>
          </div>

          {/* Timetable Scroll Container */}
          <div
            className="border rounded-xl bg-card overflow-x-auto select-none shadow-xs"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="min-w-[1050px]">
              {/* Sticky Days Header Row */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/40 sticky top-0 z-20">
                <div className="p-2 border-r text-[11px] font-semibold text-muted-foreground text-center flex items-center justify-center">
                  Godzina
                </div>
                {weekDays.map((day) => (
                  <div
                    key={day.date}
                    className={`p-2.5 border-r last:border-r-0 text-center transition-colors ${
                      day.isToday ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`text-xs font-bold ${day.isToday ? "text-primary" : "text-foreground"}`}>
                        {day.dayName}
                      </span>
                      {day.isToday ? (
                        <Badge className="bg-primary text-[9px] h-4 px-1.5 font-bold leading-none inline-flex items-center">
                          Dziś
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      {day.dayDate}
                    </span>
                  </div>
                ))}
              </div>

              {/* 24-Hour Grid Body */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
                {/* Left Hour Markers Column */}
                <div className="border-r bg-muted/10">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className="border-b text-[11px] font-mono text-muted-foreground text-center pt-1"
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* 7 Days Columns with Hour Cells and Event Overlays */}
                {weekDays.map((day) => {
                  const isThisDayDragging = dragState?.isDragging && dragState.date === day.date

                  return (
                    <div
                      key={day.date}
                      onMouseEnter={() => {
                        if (eventDrag && eventDrag.mode === "move" && eventDrag.targetDate !== day.date) {
                          setEventDrag((prev) => (prev ? { ...prev, targetDate: day.date, hasMoved: true } : null))
                        }
                      }}
                      className={`relative border-r last:border-r-0 ${
                        day.isToday ? "bg-primary/[0.02]" : ""
                      }`}
                    >
                      {/* Hour background grid cells (Interactive 30-minute slots: :00 and :30) */}
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          style={{ height: `${HOUR_HEIGHT}px` }}
                          className="border-b border-border/60 flex flex-col"
                        >
                          {/* First half hour: :00 to :30 */}
                          <div
                            style={{ height: `${HOUR_HEIGHT / 2}px` }}
                            onMouseDown={() => handleMouseDownSlot(day.date, h)}
                            onMouseEnter={() => handleMouseEnterSlot(day.date, h)}
                            className="border-b border-dashed border-border/30 hover:bg-primary/5 cursor-pointer transition-colors"
                          />
                          {/* Second half hour: :30 to :00 next */}
                          <div
                            style={{ height: `${HOUR_HEIGHT / 2}px` }}
                            onMouseDown={() => handleMouseDownSlot(day.date, h + 0.5)}
                            onMouseEnter={() => handleMouseEnterSlot(day.date, h + 0.5)}
                            className="hover:bg-primary/5 cursor-pointer transition-colors"
                          />
                        </div>
                      ))}

                      {/* Active Drag-To-Create Ghost Box */}
                      {isThisDayDragging && dragState ? (
                        <div
                          style={{
                            top: `${(dragState.startOffset - START_HOUR) * HOUR_HEIGHT}px`,
                            height: `${Math.max(26, (dragState.endOffset - dragState.startOffset) * HOUR_HEIGHT)}px`,
                          }}
                          className="absolute left-1 right-1 rounded-lg bg-primary/25 border-2 border-primary border-dashed z-10 pointer-events-none flex items-center justify-center p-1.5 shadow-sm transition-all"
                        >
                          <span className="text-[11px] font-bold text-primary bg-background/95 px-2 py-0.5 rounded shadow-xs">
                            + Nowe ({formatTimeOffset(dragState.startOffset)} – {formatTimeOffset(dragState.endOffset)})
                          </span>
                        </div>
                      ) : null}

                      {/* Active Event Drag / Resize Preview Box on target day */}
                      {eventDrag && eventDrag.hasMoved && eventDrag.targetDate === day.date ? (
                        <div
                          style={{
                            top: `${Math.max(0, (eventDrag.currentStartOffset - START_HOUR) * HOUR_HEIGHT)}px`,
                            height: `${Math.max(26, (eventDrag.currentEndOffset - eventDrag.currentStartOffset) * HOUR_HEIGHT - 4)}px`,
                          }}
                          className="absolute left-1 right-1 rounded-[6px] bg-primary/20 border-2 border-primary border-dashed z-25 pointer-events-none flex flex-col justify-between p-2 shadow-lg backdrop-blur-xs transition-all"
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold text-primary bg-background/90 px-1.5 py-0.5 rounded shadow-xs">
                            <span className="truncate">{eventDrag.event.title}</span>
                            <span className="font-mono text-[10px]">
                              {formatTimeOffset(eventDrag.currentStartOffset)} – {formatTimeOffset(eventDrag.currentEndOffset)}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground self-end bg-background/80 px-1 rounded">
                            {eventDrag.mode === "resize" ? "Zmień czas trwania" : "Przenieś"}
                          </span>
                        </div>
                      ) : null}

                      {/* Render Day Events Placed Absolutely with Overlapping Parallel Columns */}
                      {(() => {
                        const layout = computeOverlappingLayout(day.dayEvents)

                        return day.dayEvents.map((evt) => {
                          const meta = EVENT_TYPE_METADATA[evt.type]
                          const isActive = evt.status === "active"
                          const isBeingDragged = Boolean(eventDrag?.hasMoved && eventDrag?.event.id === evt.id)
                          const canEdit = userIsAdmin || evt.createdById === currentUserId

                          const startOffset = parseTimeToOffset(evt.startTime)
                          const duration = evt.endTime
                            ? calculateDurationHours(evt.startTime, evt.endTime)
                            : (evt.durationHours || 1)
                          const endOffset = startOffset + duration

                          // If the event ends before START_HOUR (07:00), don't render in daytime grid
                          if (endOffset <= START_HOUR) return null

                          const effectiveStart = Math.max(START_HOUR, startOffset)
                          const effectiveEnd = Math.min(END_HOUR, endOffset)
                          const effectiveDuration = Math.max(0.5, effectiveEnd - effectiveStart)

                          const topPx = Math.max(0, (effectiveStart - START_HOUR) * HOUR_HEIGHT)
                          const heightPx = Math.max(34, effectiveDuration * HOUR_HEIGHT - 4)

                          const pos = layout.get(evt.id) ?? { colIndex: 0, totalCols: 1 }
                          const totalCols = Math.max(1, pos.totalCols)
                          const colIndex = pos.colIndex
                          const widthPercent = 100 / totalCols
                          const leftPercent = colIndex * widthPercent

                          // Give events slight inset from the right edge so users can always drag-to-create
                          // parallel events in the free right-side strip of the hour column.
                          const RESERVED_RIGHT_GUTTER_PX = totalCols === 1 ? 18 : 6
                          const leftPx = `calc(${leftPercent}% + 2px)`
                          const widthCalc = `calc(${widthPercent}% - ${RESERVED_RIGHT_GUTTER_PX}px)`

                          const colorPreset = getEventColorPreset(evt.color)

                          return (
                            <div
                              key={evt.id}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                left: leftPx,
                                width: widthCalc,
                              }}
                              onMouseDown={(e) => {
                                // Only trigger drag move if left button and user has rights
                                if (e.button !== 0 || !canEdit || rescheduling) return
                                // If click was on resize handle, let resize handler take it
                                if ((e.target as HTMLElement).dataset.dragHandle === "resize") return

                                setEventDrag({
                                  mode: "move",
                                  event: evt,
                                  targetDate: evt.date,
                                  currentStartOffset: startOffset,
                                  currentEndOffset: endOffset,
                                  origDate: evt.date,
                                  origStartOffset: startOffset,
                                  origEndOffset: endOffset,
                                  startY: e.clientY,
                                  startX: e.clientX,
                                  hasMoved: false,
                                })
                              }}
                              onClick={() => {
                                 if (!eventDrag?.hasMoved) {
                                   handleSelectEvent(evt.id)
                                 }
                               }}
                              className={`absolute text-left rounded-[6px] pl-2.5 pr-2 py-1.5 flex flex-col justify-between text-xs transition-all z-10 shadow-xs border overflow-hidden group select-none ${
                                isBeingDragged ? "opacity-35 scale-[0.98] pointer-events-none" : ""
                              } ${
                                canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                              } hover:brightness-105 active:scale-[0.99] ${
                                isActive
                                  ? "bg-emerald-950/80 border-emerald-500/50 text-white dark:bg-emerald-900/80"
                                  : `${colorPreset.cardBg} ${colorPreset.cardBorder}`
                              }`}
                            >
                              {/* Apple Calendar signature left color bar */}
                              <div
                                className={`absolute left-0 top-0 bottom-0 w-[4px] ${
                                  isActive ? "bg-emerald-400" : colorPreset.stripeClass
                                }`}
                              />

                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center justify-between gap-1 leading-none mb-0.5">
                                  <span className={`font-mono text-[10px] tracking-tight truncate ${isActive ? "text-emerald-200" : colorPreset.timeText}`}>
                                    {evt.startTime}{evt.endTime ? ` – ${evt.endTime}` : ""}
                                  </span>
                                  {isActive ? (
                                    <Badge className="bg-emerald-500 text-[8px] h-3.5 px-1 py-0 animate-pulse font-bold">
                                      LIVE
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] shrink-0 opacity-80">{meta.icon}</span>
                                  )}
                                </div>

                                <span className={`truncate text-xs leading-snug group-hover:underline block ${isActive ? "text-white font-semibold" : colorPreset.titleText}`}>
                                  {evt.title}
                                </span>

                                {evt.mySignup ? (
                                  <div className="mt-0.5 flex items-center">
                                    <span
                                      className="inline-flex items-center justify-center h-3.5 px-1 rounded bg-emerald-500 text-white font-bold text-[9px] shadow-2xs"
                                      title={evt.mySignup.spot ? `Bierzesz udział: ${evt.mySignup.spot}` : "Bierzesz udział"}
                                    >
                                      ✓ Zapisany{evt.mySignup.spot ? ` (${evt.mySignup.spot})` : ""}
                                    </span>
                                  </div>
                                ) : null}
                              </div>

                              {heightPx > 45 ? (
                                <div className={`flex items-center justify-between text-[10px] mt-auto pt-1 border-t ${isActive ? "border-white/15 text-emerald-200" : "border-current/10 " + colorPreset.subText}`}>
                                  <span className="truncate">
                                    {evt.mySignup?.spot ? `Spot: ${evt.mySignup.spot}` : meta.label}
                                  </span>
                                  <span className="font-medium shrink-0 ml-1">{evt.uniqueUsersCount} os.</span>
                                </div>
                              ) : null}

                              {/* Resize Handle (bottom edge) - available for Admin or Creator */}
                              {canEdit ? (
                                <div
                                  data-drag-handle="resize"
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    if (e.button !== 0 || rescheduling) return
                                    setEventDrag({
                                      mode: "resize",
                                      event: evt,
                                      targetDate: evt.date,
                                      currentStartOffset: startOffset,
                                      currentEndOffset: endOffset,
                                      origDate: evt.date,
                                      origStartOffset: startOffset,
                                      origEndOffset: endOffset,
                                      startY: e.clientY,
                                      startX: e.clientX,
                                      hasMoved: false,
                                    })
                                  }}
                                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-20"
                                  title="Przeciągnij, aby zmienić czas trwania"
                                />
                              ) : null}
                            </div>
                          )
                      })})()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* 2. MONTH GRID VIEW                                                        */}
      {/* ========================================================================= */}
      {viewMode === "month" ? (
        <Card className="overflow-hidden border-border/80">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-3 pt-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-base">
                {monthNamesPl[currentMonth]} {currentYear}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="xs" variant="outline" className="h-7 w-7 p-0" onClick={handlePrevMonth}>
                ‹
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="h-7 text-xs px-2"
                onClick={() => {
                  const now = new Date()
                  setCurrentYear(now.getFullYear())
                  setCurrentMonth(now.getMonth())
                }}
              >
                Bieżący miesiąc
              </Button>
              <Button size="xs" variant="outline" className="h-7 w-7 p-0" onClick={handleNextMonth}>
                ›
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b text-center text-xs font-semibold py-2 bg-muted/20 text-muted-foreground">
              {weekDaysShortPl.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y border-b text-xs">
              {/* Empty leading cells */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[105px] bg-muted/10 p-1.5" />
              ))}

              {/* Month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
                const isToday = dateStr === today
                const dayEvents = eventsByDate.get(dateStr) ?? []

                return (
                  <div
                    key={dateStr}
                    className={`min-h-[105px] p-1.5 flex flex-col justify-between transition-colors ${
                      isToday ? "bg-primary/5 font-semibold" : "hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                          isToday
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayEvents.length > 0 ? (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {dayEvents.length} {dayEvents.length === 1 ? "akcja" : "akcje"}
                        </span>
                      ) : null}
                    </div>

                    {/* Events on this day */}
                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[85px]">
                      {dayEvents.map((evt) => {
                        const meta = EVENT_TYPE_METADATA[evt.type]
                        const isActive = evt.status === "active"
                        const colorPreset = getEventColorPreset(evt.color)
                        return (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => handleSelectEvent(evt.id)}
                            className={`group block w-full text-left rounded-[5px] border pl-2 pr-1.5 py-0.5 text-[11px] leading-tight transition-all shadow-xs relative overflow-hidden cursor-pointer hover:brightness-105 active:scale-[0.99] ${
                              isActive
                                ? "border-emerald-500/80 bg-emerald-950/20 dark:bg-emerald-900/20"
                                : `${colorPreset.cardBg} ${colorPreset.cardBorder}`
                            }`}
                          >
                            <div
                              className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                                isActive ? "bg-emerald-400" : colorPreset.stripeClass
                              }`}
                            />
                            <div className="flex items-center gap-1 truncate">
                              {evt.mySignup ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 ring-1 ring-white/50" title="Bierzesz udział" />
                              ) : null}
                              {isActive ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                              ) : (
                                <span className="text-[10px] shrink-0 opacity-80">{meta.icon}</span>
                              )}
                              <span className={`truncate ${isActive ? "text-emerald-500 font-semibold" : colorPreset.titleText + " group-hover:underline"}`}>
                                {evt.title}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] opacity-80 mt-0.5 font-mono">
                              <span>{evt.startTime}</span>
                              {evt.mySignup ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[9px]">
                                  {evt.mySignup.spot || "Zapisany"}
                                </span>
                              ) : (
                                <span>{evt.uniqueUsersCount} os.</span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ========================================================================= */}
      {/* 3. AGENDA / LIST VIEW                                                     */}
      {/* ========================================================================= */}
      {viewMode === "agenda" ? (
        <div className="flex flex-col gap-3">
          {filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-base font-medium">Brak zaplanowanych wydarzeń</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kliknij „+ Zaplanuj wydarzenie” u góry, aby dodać pierwsze spotkanie gildii.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((evt) => {
                const meta = EVENT_TYPE_METADATA[evt.type]
                const colorPreset = getEventColorPreset(evt.color)
                return (
                  <Card key={evt.id} className="flex flex-col justify-between overflow-hidden relative border shadow-xs pl-1">
                    <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${colorPreset.stripeClass}`} />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {meta.icon} {meta.label}
                            </Badge>
                            {evt.mySignup ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 font-medium">
                                ✓ Bierzesz udział {evt.mySignup.spot ? `(${evt.mySignup.spot})` : ""}
                              </Badge>
                            ) : null}
                          </div>
                          <CardTitle className="text-base font-semibold leading-snug">
                            {evt.title}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            Organizator: <span className="font-medium text-foreground">{evt.createdByNick}</span>
                          </CardDescription>
                        </div>
                        {evt.status === "active" ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] gap-1 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-ping inline-block" />
                            Trwa teraz
                          </Badge>
                        ) : evt.status === "finished" ? (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Zakończone</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] shrink-0">Zaplanowane</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 pb-4">
                      <div className="rounded-lg bg-muted/50 p-2.5 text-xs flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Termin:</span>
                          <span className="font-medium">{formatDatePl(evt.date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Godzina:</span>
                          <span className="font-mono font-medium">
                            {evt.startTime} ({evt.durationHours}h)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tryb zapisów:</span>
                          <span className="font-medium">
                            {evt.signupMode === "hourly" ? "Bloki godzinowe" : "Lista obecności / Party"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Zapisanych:</span>
                          <span className="font-medium">
                            {evt.uniqueUsersCount} osób ({evt.totalSignups} pozycji)
                          </span>
                        </div>
                      </div>

                      {evt.description ? (
                        <p className="text-xs text-muted-foreground italic truncate">
                          „{evt.description}”
                        </p>
                      ) : null}

                      <div className="pt-1 mt-auto">
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => handleSelectEvent(evt.id)}
                        >
                          Otwórz wydarzenie & Zapisy →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      <EventDetailDialog
        eventId={selectedEventId}
        open={Boolean(selectedEventId)}
        onOpenChange={(open) => !open && handleSelectEvent(null)}
        currentUserId={currentUserId}
        isLeader={userIsAdmin}
        allGuildUsers={allGuildUsers}
      />
    </div>
  )
}
