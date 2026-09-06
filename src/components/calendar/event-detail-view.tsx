"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Link2 } from "lucide-react"
import { toast } from "sonner"
import {
  deleteGuildEvent,
  signUpForGuildEvent,
  toggleGuildEventAttendance,
  updateGuildEventProperties,
  updateGuildEventStatus,
  withdrawFromGuildEvent,
} from "@/lib/actions/calendar"
import {
  EVENT_COLORS,
  EVENT_TYPE_METADATA,
  RED_LAS_EVENT_SPOTS,
  V3_EVENT_SPOTS,
  getEventColorPreset,
  type EventColorId,
  type EventDetails,
  type GuildEventType,
} from "@/lib/calendar-types"
import { formatDatePl } from "@/lib/dates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function EventDetailView({
  event,
  currentUserId,
  isLeader,
  allGuildUsers,
}: {
  event: EventDetails
  currentUserId: string
  isLeader: boolean
  allGuildUsers: { id: string; gameNick: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const meta = EVENT_TYPE_METADATA[event.type]

  // User selection for leader assignment
  const [selectedUserId, setSelectedUserId] = useState(allGuildUsers[0]?.id ?? "")

  // Party signup role
  const [partyRole, setPartyRole] = useState("")

  // Edit properties state (identical to create form)
  const [isEditing, setIsEditing] = useState(false)
  const [editType, setEditType] = useState<GuildEventType>(event.type as GuildEventType)
  const [editTitle, setEditTitle] = useState(event.title)
  const [editColor, setEditColor] = useState<EventColorId>((event.color as EventColorId) || "blue")
  const [editDate, setEditDate] = useState(event.date)
  const [editStartTime, setEditStartTime] = useState(event.startTime)
  const [editEndTime, setEditEndTime] = useState(event.endTime || "")
  const [editMaxParticipants, setEditMaxParticipants] = useState<number | "">(event.maxParticipants || "")
  const [editDescription, setEditDescription] = useState(event.description || "")
  const [updateSeries, setUpdateSeries] = useState(Boolean(event.recurrence && event.recurrence !== "none"))

  function handleSaveProperties(e?: React.FormEvent) {
    if (e) e.preventDefault()
    startTransition(async () => {
      const res = await updateGuildEventProperties({
        eventId: event.id,
        type: editType,
        title: editTitle,
        color: editColor,
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime,
        maxParticipants: editMaxParticipants ? Number(editMaxParticipants) : null,
        description: editDescription,
        updateAllInSeries: updateSeries,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setIsEditing(false)
      router.refresh()
    })
  }

  function handlePartySignUp(e: React.FormEvent) {
    e.preventDefault()
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
    })
  }

  function handleStatusChange(status: "planned" | "active" | "finished" | "cancelled") {
    startTransition(async () => {
      const res = await updateGuildEventStatus(event.id, status)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  // Custom delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  function handleCopyLink() {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(
      () => {
        setCopiedLink(true)
        toast.success("Skopiowano link do wydarzenia do schowka!")
        setTimeout(() => setCopiedLink(false), 2000)
      },
      () => {
        toast.error("Nie udało się skopiować linku.")
      }
    )
  }

  function confirmDelete(deleteAllInSeries: boolean) {
    setDeleteConfirmOpen(false)
    startTransition(async () => {
      const res = await deleteGuildEvent(event.id, { deleteAllInSeries })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      router.push("/kalendarz")
    })
  }

  function handleDelete() {
    setDeleteConfirmOpen(true)
  }

  const canManage = isLeader || event.createdById === currentUserId

  // V3 or Red Las Spot signup helper
  function handleSpotSignUp(spotId: string, role?: string) {
    startTransition(async () => {
      const res = await signUpForGuildEvent({
        eventId: event.id,
        spot: spotId,
        role: role || (event.type === "v3" ? "PvM" : undefined),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  function handleLeaderSpotAdd(spotId: string) {
    if (!selectedUserId) return
    startTransition(async () => {
      const res = await signUpForGuildEvent({
        eventId: event.id,
        spot: spotId,
        targetUserId: selectedUserId,
        role: event.type === "v3" ? "PvM" : undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setLeaderSpotModal(null)
    })
  }

  // Modal for leader to assign someone to a spot
  const [leaderSpotModal, setLeaderSpotModal] = useState<string | null>(null)
  // Selected playstyle for V3 self-signup
  const [v3Playstyle, setV3Playstyle] = useState<"PvP" | "PvM">("PvM")

  const mySignup = event.signups.find((s) => s.userId === currentUserId)
  const colorPreset = getEventColorPreset(event.color)

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/kalendarz" className="hover:underline">
          ← Wróć do kalendarza
        </Link>
      </div>

      {/* Event Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`h-3 w-3 rounded-full ${colorPreset.dotClass}`} />
            <Badge variant="secondary" className="gap-1 text-xs">
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
            </Badge>

            {event.status === "active" ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                Trwa teraz (Wystartowane)
              </Badge>
            ) : event.status === "finished" ? (
              <Badge variant="secondary">Zakończone</Badge>
            ) : event.status === "cancelled" ? (
              <Badge variant="destructive">Odwołane</Badge>
            ) : (
              <Badge variant="outline">Zaplanowane</Badge>
            )}

            {event.recurrence && event.recurrence !== "none" ? (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                🔄 Cykliczne: {event.recurrence}
              </Badge>
            ) : null}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProperties} className="flex flex-col gap-4 my-3 max-w-xl bg-card border p-4 rounded-xl shadow-xs">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="view-edit-type">Kategoria</FieldLabel>
                  <select
                    id="view-edit-type"
                    value={editType}
                    onChange={(e) => {
                      const newType = e.target.value as GuildEventType
                      setEditType(newType)
                      setEditColor(EVENT_TYPE_METADATA[newType].defaultColor)
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {Object.entries(EVENT_TYPE_METADATA).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.icon} {v.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field>
                  <FieldLabel>Kolor</FieldLabel>
                  <div className="flex items-center gap-2.5 pt-0.5">
                    {Object.entries(EVENT_COLORS).map(([cKey, cVal]) => {
                      const isSelected = editColor === cKey
                      return (
                        <button
                          key={cKey}
                          type="button"
                          onClick={() => setEditColor(cKey as EventColorId)}
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
                  <FieldLabel htmlFor="view-edit-title">Nazwa</FieldLabel>
                  <Input
                    id="view-edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="np. Wieczorne V3 lub Wyprawa na Smoka"
                    required
                  />
                </Field>

                {!updateSeries ? (
                  <Field>
                    <FieldLabel htmlFor="view-edit-date">Data</FieldLabel>
                    <Input
                      id="view-edit-date"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      required
                    />
                  </Field>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="view-edit-start">Start</FieldLabel>
                    <Input
                      id="view-edit-start"
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="view-edit-end">Koniec</FieldLabel>
                    <Input
                      id="view-edit-end"
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                {EVENT_TYPE_METADATA[editType].mode === "party" ? (
                  <Field>
                    <FieldLabel htmlFor="view-edit-max">Limit miejsc</FieldLabel>
                    <Input
                      id="view-edit-max"
                      type="number"
                      min={1}
                      max={100}
                      value={editMaxParticipants}
                      onChange={(e) =>
                        setEditMaxParticipants(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="np. 8 dla pełnego party"
                    />
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="view-edit-desc">Opis</FieldLabel>
                  <Input
                    id="view-edit-desc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="np. Wymagane przepustki i buff smok"
                  />
                </Field>

                {/* Series toggle checkbox */}
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Checkbox
                    id="page-update-series"
                    checked={updateSeries}
                    onCheckedChange={(checked) => setUpdateSeries(Boolean(checked))}
                  />
                  <label htmlFor="page-update-series" className="text-xs font-medium cursor-pointer">
                    Zastosuj do wszystkich powtarzających się wydarzeń z tej serii ({event.title})
                  </label>
                </div>
              </FieldGroup>

              <div className="flex items-center gap-2 pt-2">
                <Button size="xs" type="submit" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Zapisz zmiany
                </Button>
                <Button
                  size="xs"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setEditType(event.type as GuildEventType)
                    setEditTitle(event.title)
                    setEditColor((event.color as EventColorId) || "blue")
                    setEditDate(event.date)
                    setEditStartTime(event.startTime)
                    setEditEndTime(event.endTime || "")
                    setEditMaxParticipants(event.maxParticipants || "")
                    setEditDescription(event.description || "")
                  }}
                  disabled={pending}
                >
                  Anuluj
                </Button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-bold">{event.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Data: <span className="font-medium text-foreground">{formatDatePl(event.date)}</span> | Czas:{" "}
                <span className="font-mono font-medium text-foreground">{event.startTime}</span>
                {event.endTime ? (
                  <>
                    {" "}– <span className="font-mono font-medium text-foreground">{event.endTime}</span>
                  </>
                ) : null}{" "}
                ({event.durationHours}h)
                {event.maxParticipants ? ` | Limit: ${event.maxParticipants} osób` : ""}
              </p>
              {event.description ? (
                <p className="text-xs text-muted-foreground italic mt-1.5">„{event.description}”</p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <Button
            size="xs"
            variant="outline"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleCopyLink}
            type="button"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Skopiowano</span>
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                <span>Kopiuj link</span>
              </>
            )}
          </Button>

          {/* Status and management controls */}
          {canManage ? (
            <>
              {!isEditing ? (
                <Button
                  size="xs"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => setIsEditing(true)}
                  disabled={pending}
                >
                  <span>✏️</span>
                  <span>Edytuj</span>
                </Button>
              ) : null}

              {event.status !== "active" ? (
                <Button size="xs" variant="outline" onClick={() => handleStatusChange("active")} disabled={pending}>
                  Oznacz jako trwające
                </Button>
              ) : (
                <Button size="xs" variant="outline" onClick={() => handleStatusChange("finished")} disabled={pending}>
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
                Usuń wydarzenie
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. V3 EVENT CHARACTERISTIC: SPOTS GRID (R1, R2, R3, PRAWO, KORYTARZE)     */}
      {/* ========================================================================= */}
      {event.type === "v3" ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-purple-950/20 border border-purple-500/30 p-4 rounded-xl">
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                <span>🕷️ Siatka spotów Loch Pająków V3</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Wybierz swoją miejscówkę. Każdy spot mieści jednego gracza.
              </p>
            </div>

            {/* Playstyle selector for V3 */}
            {!mySignup ? (
              <div className="flex items-center gap-2 bg-background/80 p-1.5 rounded-lg border">
                <span className="text-xs font-medium text-muted-foreground pl-1">Mój tryb:</span>
                <Button
                  size="xs"
                  variant={v3Playstyle === "PvM" ? "default" : "ghost"}
                  className="h-6 text-xs px-2"
                  onClick={() => setV3Playstyle("PvM")}
                >
                  PvM (7 kk)
                </Button>
                <Button
                  size="xs"
                  variant={v3Playstyle === "PvP" ? "default" : "ghost"}
                  className="h-6 text-xs px-2"
                  onClick={() => setV3Playstyle("PvP")}
                >
                  PvP (3 kk)
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-500 font-medium">
                  ✓ Masz zarezerwowany spot: <span className="font-bold">{mySignup.spot}</span> ({mySignup.role || "PvM"})
                </span>
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
            )}
          </div>

          {/* V3 Spots 6-Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {V3_EVENT_SPOTS.map((spot) => {
              const spotSignup = event.signups.find((s) => s.spot === spot.id)
              const isMine = spotSignup?.userId === currentUserId
              const canToggle = spotSignup && (isLeader || spotSignup.userId === currentUserId)

              return (
                <Card
                  key={spot.id}
                  className={`flex flex-col justify-between border-2 transition-all ${
                    spotSignup
                      ? isMine
                        ? "border-purple-500 bg-purple-950/20 shadow-md"
                        : "border-border/80 bg-muted/20"
                      : "border-dashed border-border/80 hover:border-purple-500/50 hover:bg-purple-950/10"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/20"
                          style={{ backgroundColor: spot.color }}
                        />
                        <CardTitle className="text-base font-bold">{spot.name}</CardTitle>
                      </div>
                      {spotSignup ? (
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          Zajęty
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Wolny
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">{spot.desc}</CardDescription>
                  </CardHeader>

                  <CardContent className="pt-2 flex flex-col gap-3">
                    {spotSignup ? (
                      <div className="rounded-lg bg-background/80 border p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-sm truncate">{spotSignup.gameNick}</span>
                            {spotSignup.role ? (
                              <Badge variant="outline" className="text-[10px]">
                                {spotSignup.role}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t pt-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            Zapisano: {spotSignup.createdAt.slice(11, 16)}
                          </span>
                          {isLeader || isMine ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                              onClick={() => handleWithdraw(spotSignup.signupId)}
                              disabled={pending}
                            >
                              Zwolnij
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 py-2">
                        <p className="text-xs text-muted-foreground italic text-center">
                          Ten spot czeka na gracza
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="w-full text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => handleSpotSignUp(spot.id, v3Playstyle)}
                            disabled={pending || Boolean(mySignup)}
                          >
                            {Boolean(mySignup) ? "Masz już inny spot" : `Zajmij spot (${v3Playstyle})`}
                          </Button>

                          {isLeader ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs shrink-0"
                              onClick={() => setLeaderSpotModal(spot.id)}
                            >
                              + Wpisz
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : event.type === "red_las" ? (
        /* ========================================================================= */
        /* 2. RED LAS EVENT CHARACTERISTIC: SPOTS (BOSS, PÓŁKA, KONIEC LASKU, ŻARÓWA) */
        /* ========================================================================= */
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl">
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                <span>🌲 Spoty w Czerwonym Lesie</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Wybierz miejsce: Drzewo (Boss na 5 CH z podziałem dropu) lub spoty exp/drop.
              </p>
            </div>

            {mySignup ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-500 font-medium">
                  ✓ Twój spot: <span className="font-bold">{mySignup.spot}</span>
                </span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {RED_LAS_EVENT_SPOTS.map((spot) => {
              const spotSignup = event.signups.find((s) => s.spot === spot.id)
              const isMine = spotSignup?.userId === currentUserId
              const canToggle = spotSignup && (isLeader || spotSignup.userId === currentUserId)

              return (
                <Card
                  key={spot.id}
                  className={`flex flex-col justify-between border-2 transition-all ${
                    spotSignup
                      ? isMine
                        ? "border-emerald-500 bg-emerald-950/20 shadow-md"
                        : "border-border/80 bg-muted/20"
                      : "border-dashed border-border/80 hover:border-emerald-500/50 hover:bg-emerald-950/10"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{spot.icon}</span>
                        <CardTitle className="text-base font-bold">{spot.name}</CardTitle>
                      </div>
                      {spotSignup ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Zajęty
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          Wolny
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">{spot.desc}</CardDescription>
                  </CardHeader>

                  <CardContent className="pt-2 flex flex-col gap-3">
                    {spotSignup ? (
                      <div className="rounded-lg bg-background/80 border p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm truncate">{spotSignup.gameNick}</span>
                        </div>

                        <div className="flex items-center justify-between border-t pt-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {spotSignup.createdAt.slice(11, 16)}
                          </span>
                          {isLeader || isMine ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                              onClick={() => handleWithdraw(spotSignup.signupId)}
                              disabled={pending}
                            >
                              Zwolnij
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 py-2">
                        <p className="text-xs text-muted-foreground italic text-center">
                          Wolna miejscówka
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="w-full text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleSpotSignUp(spot.id)}
                            disabled={pending || Boolean(mySignup)}
                          >
                            {Boolean(mySignup) ? "Masz już inny spot" : "Zajmij spot"}
                          </Button>

                          {isLeader ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs shrink-0"
                              onClick={() => setLeaderSpotModal(spot.id)}
                            >
                              + Wpisz
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. OTHER EVENTS: PARTY / RAID ROSTER (DUNGEONY, SMOK, WOJNY)              */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Party Roster */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Skład Party / Raid</h2>
              <Badge variant="secondary" className="text-xs font-mono">
                {event.signups.length}
                {event.maxParticipants ? ` / ${event.maxParticipants}` : ""} graczy
              </Badge>
            </div>

            {event.signups.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-xs text-muted-foreground italic">
                  Nikt jeszcze nie dołączył do składu. Zapisz się formularzem obok!
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-1.5">
                {event.signups.map((p, idx) => {
                  return (
                    <Card key={p.signupId} className="p-3 border transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-muted-foreground w-5 text-center">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-sm truncate">{p.gameNick}</span>
                          {p.role ? (
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {p.role}
                            </Badge>
                          ) : null}
                        </div>

                        {isLeader || p.userId === currentUserId ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-destructive h-7"
                            onClick={() => handleWithdraw(p.signupId)}
                          >
                            Wypisz
                          </Button>
                        ) : null}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Join Form / Status Card */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Dołącz do wyprawy</CardTitle>
                <CardDescription className="text-xs">
                  Wpisz swoją postać/rolę i kliknij dołącz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mySignup ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-emerald-600 font-medium">
                      ✓ Jesteś już na liście uczestników!
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => handleWithdraw(mySignup.signupId)}
                    >
                      Wypisz się ze składu
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handlePartySignUp} className="flex flex-col gap-3">
                    <Field>
                      <FieldLabel htmlFor="party-role">Klasa / Rola</FieldLabel>
                      <Input
                        id="party-role"
                        value={partyRole}
                        onChange={(e) => setPartyRole(e.target.value)}
                        placeholder="np. Ninja Dagger 75lv / Buff Smok"
                      />
                    </Field>
                    <Button type="submit" size="sm" className="w-full text-xs font-semibold" disabled={pending}>
                      {pending ? <Spinner data-icon="inline-start" /> : null}
                      Zapisz się do składu
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Leader Assign Spot Dialog */}
      <Dialog
        open={leaderSpotModal !== null}
        onOpenChange={(open) => {
          if (!open) setLeaderSpotModal(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Wpisz gracza na spot</DialogTitle>
            <DialogDescription>
              Wybierz gracza z gildii, którego chcesz zapisać na spot:{" "}
              <span className="font-bold text-foreground">{leaderSpotModal}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Field>
              <FieldLabel htmlFor="leader-add-user">Gracz gildii</FieldLabel>
              <select
                id="leader-add-user"
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

      {/* Custom Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Usuń wydarzenie</DialogTitle>
            <DialogDescription>
              {event.recurrence && event.recurrence !== "none"
                ? `Wydarzenie "${event.title}" jest częścią serii powtarzającej się. Co chcesz usunąć?`
                : `Czy na pewno chcesz usunąć wydarzenie "${event.title}"? Tej operacji nie można cofnąć.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete(false)}
              disabled={pending}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Usuń to wydarzenie
            </Button>
            {event.recurrence && event.recurrence !== "none" && (
              <Button
                variant="destructive"
                className="bg-red-700 hover:bg-red-800"
                onClick={() => confirmDelete(true)}
                disabled={pending}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Usuń wszystkie
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
