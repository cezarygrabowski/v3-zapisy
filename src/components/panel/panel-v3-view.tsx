"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { recordBaronKill, recordQueenKill, undoKill } from "@/lib/actions/run"
import {
  signUpForGuildEvent,
  updateGuildEventStatus,
  withdrawFromGuildEvent,
} from "@/lib/actions/calendar"
import { MAP_ZONES, POSITIONS, positionLabel, slotLabel, type PositionId, type SlotId } from "@/lib/constants"
import type { KillLogItem, RosterMember, RunSyncState } from "@/lib/queries"
import type { EventDetails } from "@/lib/calendar-types"
import { formatDatePl } from "@/lib/dates"
import { V3Map } from "@/components/v3-map"
import { RunTimers } from "@/components/run-timers"
import { EventDetailDialog } from "@/components/calendar/event-detail-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

export function PanelV3View({
  slot,
  roster,
  kills,
  syncs,
  v3CalendarEvent,
  queenCounts,
  users,
  currentUserId,
  isLeader,
}: {
  slot: { id: SlotId; label: string; status: "trwa" | "nastepny" | "skonczony" }
  roster: RosterMember[]
  kills: KillLogItem[]
  syncs: RunSyncState[]
  v3CalendarEvent?: EventDetails | null
  queenCounts: { userId: string; queens: number }[]
  users: { id: string; gameNick: string }[]
  currentUserId: string
  isLeader: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [v3Playstyle, setV3Playstyle] = useState<"PvM" | "PvP">("PvM")

  // If there's an active/upcoming V3 calendar event with spots, use its spots as the roster
  const calendarSpotsRoster: RosterMember[] | null = v3CalendarEvent
    ? POSITIONS.map((pos) => {
        const signup = v3CalendarEvent.signups.find((s) => s.spot === pos.id)
        return {
          position: pos.id,
          userId: signup?.userId ?? null,
          gameNick: signup?.gameNick ?? null,
        }
      })
    : null

  const effectiveRoster = calendarSpotsRoster ?? roster
  const byPosition = new Map(effectiveRoster.map((m) => [m.position, m]))
  const lastQueen = kills.find((k) => k.kind === "queen")

  const occupied = effectiveRoster.filter((member) => member.userId)
  const people =
    occupied.length > 0
      ? occupied.map((member) => ({
          id: member.userId as string,
          gameNick: member.gameNick as string,
        }))
      : users

  const countByUser = new Map(queenCounts.map((row) => [row.userId, row.queens]))
  const party = people.map((person) => ({
    nick: person.gameNick,
    queens: countByUser.get(person.id) ?? 0,
  }))
  const minQueens = party.length === 0 ? 0 : Math.min(...party.map((row) => row.queens))
  const nextQueen = {
    nicks: party.filter((row) => row.queens === minQueens).map((row) => row.nick),
    queens: minQueens,
    party,
  }

  // Calendar event my-signup
  const myEventSignup = v3CalendarEvent?.signups.find((s) => s.userId === currentUserId)

  function handleSpotSignUp(spotId: string) {
    if (!v3CalendarEvent) return
    startTransition(async () => {
      const res = await signUpForGuildEvent({
        eventId: v3CalendarEvent.id,
        spot: spotId,
        role: v3Playstyle,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  function handleWithdrawSpot(signupId: string) {
    startTransition(async () => {
      const res = await withdrawFromGuildEvent({ signupId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  function handleQuickQueenKill() {
    startTransition(async () => {
      const res = await recordQueenKill()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  function handleUndoKill(killId: string) {
    startTransition(async () => {
      const res = await undoKill(killId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* V3 Calendar Event Header Banner */}
      <div className="flex flex-col gap-3 bg-muted/40 border p-4 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-lg font-bold">
                {v3CalendarEvent ? v3CalendarEvent.title : `Loch Pająków V3 – Slot ${slot.id}`}
              </h2>
              {v3CalendarEvent ? (
                <Badge
                  variant={v3CalendarEvent.status === "active" ? "default" : "secondary"}
                  className={
                    v3CalendarEvent.status === "active"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                      : "text-xs"
                  }
                >
                  {v3CalendarEvent.status === "active"
                    ? "Wystartowane (Trwa)"
                    : v3CalendarEvent.status === "finished"
                      ? "Zakończone"
                      : "Zaplanowane"}
                </Badge>
              ) : (
                <Badge
                  variant={slot.status === "trwa" ? "default" : "secondary"}
                  className={slot.status === "trwa" ? "bg-emerald-600 hover:bg-emerald-700 text-xs" : "text-xs"}
                >
                  {slot.status === "trwa" ? "Trwa teraz" : slot.status === "nastepny" ? "Następny slot" : "Zakończony"}
                </Badge>
              )}

              {v3CalendarEvent ? (
                <Badge variant="outline" className="text-[11px] font-mono">
                  📅 Wydarzenie z kalendarza
                </Badge>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              {v3CalendarEvent ? (
                <>
                  Termin: <span className="font-medium text-foreground">{formatDatePl(v3CalendarEvent.date)}</span>,{" "}
                  godz. <span className="font-mono font-medium text-foreground">{v3CalendarEvent.startTime}</span>
                  {v3CalendarEvent.endTime ? (
                    <>
                      {" "}– <span className="font-mono font-medium text-foreground">{v3CalendarEvent.endTime}</span>
                    </>
                  ) : null}{" "}
                  ({v3CalendarEvent.durationHours}h) • Organizator:{" "}
                  <span className="font-medium text-foreground">{v3CalendarEvent.createdByNick}</span>
                </>
              ) : (
                <>{slotLabel(slot.id)} • Szybkie zarządzanie zbiciami i podgląd obsady miejscówek na bieżąco.</>
              )}
            </p>

            {v3CalendarEvent?.description ? (
              <p className="text-xs text-muted-foreground italic mt-0.5">
                „{v3CalendarEvent.description}”
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {v3CalendarEvent ? (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
                onClick={() => setCalendarModalOpen(true)}
              >
                📋 Szczegóły / Zapisy
              </Button>
            ) : null}

            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 shadow-xs"
              disabled={pending}
              onClick={handleQuickQueenKill}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              ⚡ Zbiłem Królową V3
            </Button>
          </div>
        </div>

        {/* Quick Self Signup bar if an event exists */}
        {v3CalendarEvent ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t pt-2.5 mt-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Twój status:</span>
              {myEventSignup ? (
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ Zapisany na spot {myEventSignup.spot || "bez miejscówki"} ({myEventSignup.role || "PvM"})
                </span>
              ) : (
                <span className="text-muted-foreground italic">Nie jesteś jeszcze zapisany na to wydarzenie</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!myEventSignup ? (
                <div className="flex items-center gap-1.5 bg-background p-1 rounded-md border">
                  <span className="text-[11px] text-muted-foreground px-1">Tryb:</span>
                  <button
                    type="button"
                    onClick={() => setV3Playstyle("PvM")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      v3Playstyle === "PvM" ? "bg-primary text-primary-foreground font-bold" : "hover:bg-muted"
                    }`}
                  >
                    PvM (7 kk)
                  </button>
                  <button
                    type="button"
                    onClick={() => setV3Playstyle("PvP")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      v3Playstyle === "PvP" ? "bg-primary text-primary-foreground font-bold" : "hover:bg-muted"
                    }`}
                  >
                    PvP (3 kk)
                  </button>
                </div>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  className="text-destructive hover:text-destructive text-[11px] h-6"
                  disabled={pending}
                  onClick={() => handleWithdrawSpot(myEventSignup.signupId)}
                >
                  Zrezygnuj ze spota
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Main split: Spots roster & Timers / Kill tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: 6 Positions Roster */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3 bg-muted/20">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>
                  Obsada miejscówek ({effectiveRoster.filter((r) => r.userId).length} / 6)
                </span>
                <span className="text-xs font-mono font-normal text-muted-foreground">
                  {v3CalendarEvent ? `${v3CalendarEvent.startTime}–${v3CalendarEvent.endTime || ""}` : `Slot ${slot.id}`}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {v3CalendarEvent
                  ? "Obsada pobierana bezpośrednio z zapisów na wydarzenie w kalendarzu."
                  : "Kto aktualnie expi/dropi na którym spocie."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-2">
              {POSITIONS.map((pos) => {
                const member = byPosition.get(pos.id)
                const isOccupied = Boolean(member?.userId)
                const isMine = member?.userId === currentUserId
                const zoneInfo = MAP_ZONES.find((z) => z.position === pos.id)
                const spotSignup = v3CalendarEvent?.signups.find((s) => s.spot === pos.id)

                return (
                  <div
                    key={pos.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                      isOccupied
                        ? isMine
                          ? "bg-primary/10 border-primary/40 font-semibold"
                          : "bg-card border-border/80"
                        : "border-dashed border-border/70 bg-muted/10 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full shrink-0 shadow-xs border border-black/20"
                        style={{ backgroundColor: zoneInfo?.color || "#888" }}
                      />
                      <span className="font-heading font-bold text-sm min-w-[75px] truncate">
                        {pos.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                        {zoneInfo?.note}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOccupied ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`truncate ${isMine ? "text-primary font-bold" : "text-foreground font-medium"}`}>
                            {member?.gameNick}
                          </span>
                          {spotSignup?.role ? (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              {spotSignup.role}
                            </Badge>
                          ) : null}
                          {isMine ? (
                            <Badge className="bg-primary text-primary-foreground text-[9px] h-4 px-1">
                              Ty
                            </Badge>
                          ) : null}

                          {v3CalendarEvent && (isMine || isLeader) && spotSignup ? (
                            <button
                              type="button"
                              onClick={() => handleWithdrawSpot(spotSignup.signupId)}
                              disabled={pending}
                              className="text-[10px] text-muted-foreground hover:text-destructive underline ml-1"
                            >
                              Zwolnij
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] italic text-muted-foreground">Wolny spot</span>
                          {v3CalendarEvent && !myEventSignup ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-xs h-6 px-1.5 text-purple-600 dark:text-purple-400 font-semibold hover:bg-purple-500/10"
                              disabled={pending}
                              onClick={() => handleSpotSignUp(pos.id)}
                            >
                              + Zajmij
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Compact Minimap */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 bg-muted/20">
              <CardTitle className="text-sm font-bold">Mapa Lochu Pająków V3</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <V3Map
                roster={effectiveRoster.map((member) => ({
                  position: member.position,
                  gameNick: member.gameNick,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column: Timers and recent kill feed */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <RunTimers
            syncs={syncs}
            lastQueenKill={
              lastQueen
                ? { at: lastQueen.killedAt, label: lastQueen.killedAtLabel }
                : null
            }
            nextQueen={nextQueen}
          />

          {/* Recent Kills Feed */}
          <Card>
            <CardHeader className="pb-3 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Historia zbić z dzisiaj</span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {kills.length} zbić
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {kills.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">
                  Brak odnotowanych zbić na dzisiejszym runie.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                  {kills.slice(0, 15).map((kill) => {
                    const isQueen = kill.kind === "queen"
                    const canUndo = isLeader || kill.reportedBy === currentUserId

                    return (
                      <div
                        key={kill.id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-muted/10 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isQueen ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-purple-500/20 text-purple-600 dark:text-purple-400"}`}>
                            {isQueen ? "🕷️ Królowa" : "👑 Baronówna"}
                          </span>
                          <span className="font-mono text-muted-foreground text-[11px]">
                            {kill.killedAtLabel}
                          </span>
                          <span className="font-medium truncate">
                            {kill.reporterNick}
                          </span>
                        </div>

                        {canUndo ? (
                          <button
                            type="button"
                            onClick={() => handleUndoKill(kill.id)}
                            disabled={pending}
                            className="text-[11px] text-muted-foreground hover:text-destructive hover:underline ml-2"
                          >
                            Cofnij
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Calendar Event Full Details Modal */}
      {v3CalendarEvent ? (
        <EventDetailDialog
          eventId={v3CalendarEvent.id}
          open={calendarModalOpen}
          onOpenChange={setCalendarModalOpen}
          currentUserId={currentUserId}
          isLeader={isLeader}
          allGuildUsers={users}
        />
      ) : null}
    </div>
  )
}
