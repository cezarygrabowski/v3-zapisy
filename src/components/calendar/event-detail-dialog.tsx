"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  deleteGuildEvent,
  getGuildEventModalDetails,
  signUpForGuildEvent,
  toggleGuildEventAttendance,
  updateGuildEventStatus,
  withdrawFromGuildEvent,
} from "@/lib/actions/calendar"
import {
  EVENT_TYPE_METADATA,
  RED_LAS_EVENT_SPOTS,
  V3_EVENT_SPOTS,
  getEventColorPreset,
  type EventDetails,
} from "@/lib/calendar-types"
import { formatDatePl } from "@/lib/dates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function EventDetailDialog({
  eventId,
  open,
  onOpenChange,
  currentUserId,
  isLeader,
  allGuildUsers,
  onEventUpdated,
}: {
  eventId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  isLeader: boolean
  allGuildUsers: { id: string; gameNick: string }[]
  onEventUpdated?: () => void
}) {
  const [event, setEvent] = useState<EventDetails | null>(null)
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Selection for leader assigning someone
  const [selectedUserId, setSelectedUserId] = useState(allGuildUsers[0]?.id ?? "")
  const [leaderSpotModal, setLeaderSpotModal] = useState<string | null>(null)

  // Party signup role
  const [partyRole, setPartyRole] = useState("")

  const isLoading = open && Boolean(eventId) && loadedEventId !== eventId

  useEffect(() => {
    if (!open || !eventId) {
      return
    }

    let active = true

    getGuildEventModalDetails(eventId)
      .then((data) => {
        if (active) {
          setEvent(data)
          setLoadedEventId(eventId)
        }
      })
      .catch(() => {
        if (active) {
          toast.error("Nie udało się pobrać szczegółów wydarzenia.")
          setLoadedEventId(eventId)
        }
      })

    return () => {
      active = false
    }
  }, [open, eventId])

  function refreshDetails() {
    if (!eventId) return
    getGuildEventModalDetails(eventId).then((data) => {
      if (data) setEvent(data)
      onEventUpdated?.()
    })
  }

  function handleSpotSignUp(spotId: string, role?: string) {
    if (!event) return
    startTransition(async () => {
      const res = await signUpForGuildEvent({
        eventId: event.id,
        spot: spotId,
        role: role,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      refreshDetails()
    })
  }

  function handleLeaderSpotAdd(spotId: string) {
    if (!event || !selectedUserId) return
    startTransition(async () => {
      const res = await signUpForGuildEvent({
        eventId: event.id,
        spot: spotId,
        targetUserId: selectedUserId,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setLeaderSpotModal(null)
      refreshDetails()
    })
  }

  function handleWithdraw(signupId: string) {
    startTransition(async () => {
      const res = await withdrawFromGuildEvent({ signupId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      refreshDetails()
    })
  }

  function handleToggleAttendance(signupId: string) {
    startTransition(async () => {
      const res = await toggleGuildEventAttendance(signupId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      refreshDetails()
    })
  }

  function handlePartySignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!event) return
    startTransition(async () => {
      const res = await signUpForGuildEvent({
        eventId: event.id,
        role: partyRole,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setPartyRole("")
      refreshDetails()
    })
  }

  function handleStatusChange(status: "planned" | "active" | "finished" | "cancelled") {
    if (!event) return
    startTransition(async () => {
      const res = await updateGuildEventStatus(event.id, status)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      refreshDetails()
    })
  }

  function handleDelete() {
    if (!event || !confirm("Czy na pewno chcesz usunąć to wydarzenie?")) return
    startTransition(async () => {
      const res = await deleteGuildEvent(event.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      onOpenChange(false)
      onEventUpdated?.()
    })
  }

  const meta = event ? EVENT_TYPE_METADATA[event.type] : null
  const colorPreset = event ? getEventColorPreset(event.color) : null
  const mySignup = event?.signups.find((s) => s.userId === currentUserId)
  const canManage = Boolean(event && (isLeader || event.createdById === currentUserId))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80 shadow-2xl">
          {isLoading || !event || !meta || !colorPreset ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3">
              <Spinner className="h-8 w-8" />
              <p className="text-sm text-muted-foreground">Ładowanie szczegółów wydarzenia...</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Header with Apple accent strip & event meta */}
              <div className="relative p-6 border-b bg-muted/20">
                <div
                  className={`absolute left-0 top-0 bottom-0 w-[5px] ${colorPreset.stripeClass}`}
                />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`h-2.5 w-2.5 rounded-full ${colorPreset.dotClass}`} />
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </Badge>

                      {event.status === "active" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 font-medium text-xs">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                          </span>
                          Trwa teraz (LIVE)
                        </Badge>
                      ) : event.status === "finished" ? (
                        <Badge variant="secondary" className="text-xs">Zakończone</Badge>
                      ) : event.status === "cancelled" ? (
                        <Badge variant="destructive" className="text-xs">Odwołane</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Zaplanowane</Badge>
                      )}

                      {event.recurrence && event.recurrence !== "none" ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          🔄 {event.recurrence}
                        </Badge>
                      ) : null}
                    </div>

                    <DialogTitle className="font-heading text-2xl font-bold tracking-tight">
                      {event.title}
                    </DialogTitle>

                    <DialogDescription className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>📅 {formatDatePl(event.date)}</span>
                      <span>⏱️ <strong className="font-mono text-foreground">{event.startTime}</strong>{event.endTime ? ` – ${event.endTime}` : ""} ({event.durationHours}h)</span>
                      <span>👑 Organizator: <strong className="text-foreground">{event.createdByNick}</strong></span>
                    </DialogDescription>

                    {event.description ? (
                      <p className="text-xs text-muted-foreground italic mt-2 bg-background/50 border rounded-md p-2 max-w-xl">
                        „{event.description}”
                      </p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-1.5 shrink-0 self-start">
                      {event.status !== "active" ? (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleStatusChange("active")}
                          disabled={pending}
                        >
                          Wystartuj
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleStatusChange("finished")}
                          disabled={pending}
                        >
                          Zakończ
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={handleDelete}
                        disabled={pending}
                      >
                        Usuń
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Main Content: Interactive Spots or Roster Panel */}
              <div className="p-6 flex flex-col gap-6">
                {/* 1. V3 INTERACTIVE SPOTS LIST */}
                {event.type === "v3" ? (
                  <div className="flex flex-col gap-4">
                    {/* User signup status banner if signed up */}
                    {mySignup ? (
                      <div
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${colorPreset.cardBg} ${colorPreset.cardBorder}`}
                      >
                        <Badge className={`${colorPreset.badgeClass} text-xs px-2.5 py-1 font-medium`}>
                          Twój spot: {mySignup.spot} {mySignup.role ? `(${mySignup.role})` : ""}
                        </Badge>
                        <Button
                          size="xs"
                          variant="outline"
                          className="text-xs text-destructive hover:text-destructive h-7"
                          onClick={() => handleWithdraw(mySignup.signupId)}
                          disabled={pending}
                        >
                          Zwolnij spot
                        </Button>
                      </div>
                    ) : null}

                    {/* Vertical list of spots - one under another */}
                    <div className="flex flex-col gap-2.5">
                      {V3_EVENT_SPOTS.map((spot) => {
                        const spotSignup = event.signups.find((s) => s.spot === spot.id)
                        const isMine = spotSignup?.userId === currentUserId
                        const canToggle = spotSignup && (isLeader || spotSignup.userId === currentUserId)

                        return (
                          <div
                            key={spot.id}
                            className={`rounded-xl border transition-all p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              spotSignup
                                ? isMine
                                  ? `${colorPreset.cardBorder} ${colorPreset.cardBg} shadow-xs ring-1 ring-primary/20`
                                  : "border-border/70 bg-card/60"
                                : `border-dashed border-border/80 hover:${colorPreset.cardBorder} bg-muted/10`
                            }`}
                          >
                            {/* Left: Spot info with color indicator dot */}
                            <div className="flex items-center gap-3 min-w-[200px]">
                              <span
                                className="h-4 w-4 rounded-full shrink-0 shadow-xs border border-black/20"
                                style={{ backgroundColor: spot.color }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-heading font-bold text-sm leading-tight">
                                    {spot.name}
                                  </span>
                                  {spotSignup ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                                      Zajęty
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold border-emerald-500/30 px-1.5 py-0"
                                    >
                                      Wolny
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground truncate block">
                                  {spot.desc}
                                </span>
                              </div>
                            </div>

                            {/* Center / Details: Occupant info if signed up */}
                            {spotSignup ? (
                              <div className="flex flex-1 items-center justify-between sm:justify-center gap-3 bg-background/70 border px-3 py-1.5 rounded-lg text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold truncate">
                                    {spotSignup.gameNick}
                                  </span>
                                  {spotSignup.role ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-medium px-1.5 py-0"
                                    >
                                      {spotSignup.role}
                                    </Badge>
                                  ) : null}
                                </div>

                                <span className="text-[11px] text-muted-foreground shrink-0">
                                  zapisano {spotSignup.createdAt.slice(11, 16)}
                                </span>
                              </div>
                            ) : (
                              <div className="hidden sm:block flex-1" />
                            )}

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 justify-end shrink-0">
                              {spotSignup ? (
                                isLeader || isMine ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleWithdraw(spotSignup.signupId)}
                                    disabled={pending}
                                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                                  >
                                    Zwolnij
                                  </Button>
                                ) : null
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    className={`h-8 text-xs font-semibold ${colorPreset.badgeClass} shadow-xs px-4`}
                                    onClick={() => handleSpotSignUp(spot.id)}
                                    disabled={pending || Boolean(mySignup)}
                                  >
                                    {Boolean(mySignup) ? "Zajęto inny spot" : "Zajmij spot"}
                                  </Button>

                                  {isLeader ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs px-2.5"
                                      onClick={() => setLeaderSpotModal(spot.id)}
                                    >
                                      + Wpisz
                                    </Button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : event.type === "red_las" ? (
                  /* 2. RED LAS INTERACTIVE SPOTS GRID */
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between bg-emerald-950/15 border border-emerald-500/25 p-3.5 rounded-xl">
                      <div>
                        <span className="font-heading font-semibold text-sm block">
                          🌲 Spoty i Wyprawa na Red Las (ElderMT2)
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Drzewo (Boss 5 CH) lub spoty exp/drop (Półka, Koniec lasku, Żarówa).
                        </span>
                      </div>

                      {mySignup ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-600 text-xs px-2.5 py-1">
                            Twój spot: {mySignup.spot}
                          </Badge>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-xs text-destructive hover:text-destructive h-7"
                            onClick={() => handleWithdraw(mySignup.signupId)}
                            disabled={pending}
                          >
                            Zwolnij spot
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {RED_LAS_EVENT_SPOTS.map((spot) => {
                        const spotSignup = event.signups.find((s) => s.spot === spot.id)
                        const isMine = spotSignup?.userId === currentUserId
                        const canToggle = spotSignup && (isLeader || spotSignup.userId === currentUserId)

                        return (
                          <div
                            key={spot.id}
                            className={`rounded-xl border-2 transition-all p-3.5 flex flex-col justify-between gap-3 ${
                              spotSignup
                                ? isMine
                                  ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                                  : "border-border/70 bg-card/60"
                                : "border-dashed border-border/80 hover:border-emerald-500/60 bg-muted/10 hover:bg-emerald-500/5"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="text-base">{spot.icon}</span>
                                {spotSignup ? (
                                  <Badge variant="secondary" className="text-[10px]">Zajęty</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">Wolny</Badge>
                                )}
                              </div>
                              <span className="font-heading font-bold text-sm block truncate">
                                {spot.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground block truncate">
                                {spot.desc}
                              </span>
                            </div>

                            {spotSignup ? (
                              <div className="rounded-lg bg-background/90 border p-2.5 flex flex-col gap-1.5 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-xs truncate">{spotSignup.gameNick}</span>
                                </div>
                                <div className="flex items-center justify-between border-t pt-1 text-[10px] text-muted-foreground">
                                  <span>{spotSignup.createdAt.slice(11, 16)}</span>
                                  {isLeader || isMine ? (
                                    <button
                                      type="button"
                                      onClick={() => handleWithdraw(spotSignup.signupId)}
                                      disabled={pending}
                                      className="text-muted-foreground hover:text-destructive hover:underline font-medium"
                                    >
                                      Zwolnij
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 pt-1">
                                <Button
                                  size="sm"
                                  className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleSpotSignUp(spot.id)}
                                  disabled={pending || Boolean(mySignup)}
                                >
                                  {Boolean(mySignup) ? "Zajęto inny spot" : "Zajmij spot"}
                                </Button>
                                {isLeader ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs shrink-0 px-2"
                                    onClick={() => setLeaderSpotModal(spot.id)}
                                  >
                                    +
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  /* 3. PARTY / RAID ROSTER FOR OTHER EVENTS (DUNGEON, BOSS, WAR) */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading font-semibold text-sm">Skład Party / Uczestnicy</h3>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {event.signups.length}{event.maxParticipants ? ` / ${event.maxParticipants}` : ""} graczy
                        </Badge>
                      </div>

                      {event.signups.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                          Brak zapisanych osób. Bądź pierwszy!
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
                          {event.signups.map((p, idx) => {
                            return (
                              <div
                                key={p.signupId}
                                className="rounded-lg border p-2.5 flex items-center justify-between transition-colors bg-card"
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <span className="font-mono text-xs text-muted-foreground w-4 text-center">
                                    #{idx + 1}
                                  </span>
                                  <span className="font-semibold text-xs truncate">{p.gameNick}</span>
                                  {p.role ? (
                                    <Badge variant="outline" className="text-[10px]">
                                      {p.role}
                                    </Badge>
                                  ) : null}
                                </div>

                                {isLeader || p.userId === currentUserId ? (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="text-xs text-muted-foreground hover:text-destructive h-6 px-2"
                                    onClick={() => handleWithdraw(p.signupId)}
                                  >
                                    Wypisz
                                  </Button>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Join Box */}
                    <div className="flex flex-col gap-3">
                      <div className="rounded-xl border p-4 bg-muted/20 flex flex-col gap-3">
                        <span className="font-heading font-semibold text-sm">Dołącz do wyprawy</span>
                        {mySignup ? (
                          <div className="flex flex-col gap-2 text-xs">
                            <span className="text-emerald-500 font-medium">✓ Jesteś już zapisany!</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive"
                              onClick={() => handleWithdraw(mySignup.signupId)}
                            >
                              Wypisz się
                            </Button>
                          </div>
                        ) : (
                          <form onSubmit={handlePartySignUp} className="flex flex-col gap-3">
                            <Field>
                              <FieldLabel htmlFor="modal-party-role">Klasa / Rola (opcjonalnie)</FieldLabel>
                              <Input
                                id="modal-party-role"
                                value={partyRole}
                                onChange={(e) => setPartyRole(e.target.value)}
                                placeholder="np. Sura WP 75 / Buff"
                                className="h-8 text-xs"
                              />
                            </Field>
                            <Button type="submit" size="sm" className="w-full text-xs font-semibold" disabled={pending}>
                              {pending ? <Spinner data-icon="inline-start" /> : null}
                              Zapisz się do składu
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Leader Assign Dialog */}
      <Dialog
        open={leaderSpotModal !== null}
        onOpenChange={(op) => {
          if (!op) setLeaderSpotModal(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wpisz gracza na spot</DialogTitle>
            <DialogDescription>
              Wybierz gracza z gildii na pozycję:{" "}
              <strong className="text-foreground">{leaderSpotModal}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Field>
              <FieldLabel htmlFor="modal-leader-user">Gracz gildii</FieldLabel>
              <select
                id="modal-leader-user"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {allGuildUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.gameNick}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaderSpotModal(null)}>
              Anuluj
            </Button>
            <Button
              disabled={pending}
              onClick={() => leaderSpotModal && handleLeaderSpotAdd(leaderSpotModal)}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Wpisz gracza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
