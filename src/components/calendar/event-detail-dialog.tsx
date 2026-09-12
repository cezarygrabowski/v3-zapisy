"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Check, Link2, Users, Crown, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import {
  deleteGuildEvent,
  getGuildEventModalDetails,
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
import { formatDatePl, getTimeUntilEvent, getV3SignupOpenDate, isV3SignupDateLocked, todayInWarsaw } from "@/lib/dates"
import { positionLabel } from "@/lib/constants"
import { SpotTransferDialog } from "@/components/calendar/spot-transfer-dialog"
import { GiveYellowCardDialog } from "@/components/calendar/give-yellow-card-dialog"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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

  // Character selection for multi-character signup
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  // Party signup role
  const [partyRole, setPartyRole] = useState("")

  // Edit properties state (identical to create form)
  const [isEditing, setIsEditing] = useState(false)
  const [editType, setEditType] = useState<GuildEventType>("v3")
  const [editTitle, setEditTitle] = useState("")
  const [editColor, setEditColor] = useState<EventColorId>("blue")
  const [editDate, setEditDate] = useState("")
  const [editStartTime, setEditStartTime] = useState("")
  const [editEndTime, setEditEndTime] = useState("")
  const [editMaxParticipants, setEditMaxParticipants] = useState<number | "">("")
  const [editDescription, setEditDescription] = useState("")
  const [updateSeries, setUpdateSeries] = useState(true)

  const isLoading = open && Boolean(eventId) && loadedEventId !== eventId

  useEffect(() => {
    if (!open || !eventId) {
      return
    }

    setSelectedCharacterId(null)
    let active = true

    getGuildEventModalDetails(eventId)
      .then((data) => {
        if (active) {
          setEvent(data)
          setLoadedEventId(eventId)
          if (data) {
            setEditType(data.type as GuildEventType)
            setEditTitle(data.title)
            setEditColor((data.color as EventColorId) || "blue")
            setEditDate(data.date)
            setEditStartTime(data.startTime)
            setEditEndTime(data.endTime || "")
            setEditMaxParticipants(data.maxParticipants || "")
            setEditDescription(data.description || "")
            setIsEditing(false)
            setUpdateSeries(Boolean(data.recurrence && data.recurrence !== "none"))
          }
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
    getGuildEventModalDetails(eventId)
      .then((data) => {
        if (data) setEvent(data)
        onEventUpdated?.()
      })
      .catch((err) => {
        console.error("Failed to refresh event details:", err)
      })
  }

  function handleSpotSignUp(spotId: string, role?: string, characterId?: string) {
    if (!event) return
    startTransition(async () => {
      const res = await signUpForGuildEvent({
        eventId: event.id,
        spot: spotId,
        role: role,
        characterId: characterId || selectedCharacterId || undefined,
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

  // State for admin withdrawing someone with reason
  const [adminWithdrawTarget, setAdminWithdrawTarget] = useState<{
    signupId: string
    userId: string
    userName: string
    spot?: string | null
  } | null>(null)
  const [adminWithdrawReason, setAdminWithdrawReason] = useState("")
  const [adminGiveYellowCard, setAdminGiveYellowCard] = useState(false)
  const [adminYellowCardReason, setAdminYellowCardReason] = useState("")

  // State for transferring spot to another player
  const [transferModal, setTransferModal] = useState<{
    signupId: string
    spot: string | null
    ownerNick: string
  } | null>(null)

  // State for admin directly giving yellow card from event
  const [giveYellowCardTarget, setGiveYellowCardTarget] = useState<{
    userId: string
    userNick: string
  } | null>(null)

  function handleWithdrawClick(signup: { signupId: string; userId: string; gameNick?: string; spot?: string | null }) {
    if (isLeader && signup.userId !== currentUserId) {
      setAdminWithdrawReason("")
      setAdminGiveYellowCard(false)
      setAdminYellowCardReason("")
      setAdminWithdrawTarget({
        signupId: signup.signupId,
        userId: signup.userId,
        userName: signup.gameNick || "gracza",
        spot: signup.spot,
      })
      return
    }

    // Direct withdrawal for self - check 2h rule
    if (event) {
      const timeInfo = getTimeUntilEvent(event.date, event.startTime)
      if (timeInfo.isLessThan2Hours && !timeInfo.hasStarted) {
        if (
          !confirm(
            `⚠️ UWAGA: Do rozpoczęcia wydarzenia zostało tylko ${timeInfo.label} (< 2h)!\n\nZwolnienie spota w ostatniej chwili może skutkować żółtą kartką od administratora.\n\nZalecamy skorzystanie z opcji „Przekaż miejscówkę” (zastępstwo).\n\nCzy na pewno chcesz zwolnić swój spot?`
          )
        ) {
          return
        }
      }
    }

    startTransition(async () => {
      const res = await withdrawFromGuildEvent({ signupId: signup.signupId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      refreshDetails()
    })
  }

  function handleConfirmAdminWithdraw() {
    if (!adminWithdrawTarget) return
    startTransition(async () => {
      const res = await withdrawFromGuildEvent({
        signupId: adminWithdrawTarget.signupId,
        reason: adminWithdrawReason.trim() || undefined,
        giveYellowCard: adminGiveYellowCard,
        yellowCardReason: adminYellowCardReason.trim() || adminWithdrawReason.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setAdminWithdrawTarget(null)
      setAdminWithdrawReason("")
      setAdminGiveYellowCard(false)
      setAdminYellowCardReason("")
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

  // Custom delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  function handleCopyLink() {
    if (!event) return
    const url = `${window.location.origin}/kalendarz?wydarzenie=${event.id}`
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
    if (!event) return
    setDeleteConfirmOpen(false)
    startTransition(async () => {
      const res = await deleteGuildEvent(event.id, { deleteAllInSeries })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      onOpenChange(false)
      onEventUpdated?.()
    })
  }

  function handleDelete() {
    if (!event) return
    setDeleteConfirmOpen(true)
  }

  function handleSaveProperties(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!event) return
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
      refreshDetails()
    })
  }

  const meta = event ? EVENT_TYPE_METADATA[event.type] : null
  const colorPreset = event ? getEventColorPreset(event.color) : null
  const mySignups = event?.signups.filter((s) => s.userId === currentUserId) ?? []
  const mySignup = mySignups[0]
  const userCharacters = event?.currentUserCharacters ?? []
  const activeChar =
    userCharacters.find((c) => c.id === selectedCharacterId) ||
    userCharacters.find((c) => c.isMain) ||
    userCharacters[0]
  const isEventDay = Boolean(event && event.date === todayInWarsaw(new Date()))
  const canManage = Boolean(event && (isLeader || event.createdById === currentUserId))
  const isV3 = event?.type === "v3"
  const userPenalty = event?.currentUserPenalty
  const normalAdvanceDays = event?.signupAdvanceDays ?? 2
  const maxDaysAhead = userPenalty?.hasPenalty
    ? (userPenalty.allowedAdvanceDays ?? 1)
    : normalAdvanceDays
  const signupOpenTime = (event as unknown as { signupOpenTime?: string })?.signupOpenTime ?? "09:00"
  const isDateLocked = Boolean(event && isV3 && isV3SignupDateLocked(event.date, new Date(), maxDaysAhead, signupOpenTime))
  const unlockDatePl = event && isV3 ? formatDatePl(getV3SignupOpenDate(event.date, maxDaysAhead)) : ""
  const feeLock = isV3 ? event?.currentUserFeeLock : undefined
  const isFeeLocked = Boolean(feeLock?.isLocked)
  const isLocked = isDateLocked || isFeeLocked

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

                      {isFeeLocked ? (
                        <Badge
                          variant="destructive"
                          className="text-xs gap-1 font-medium bg-red-600/90 hover:bg-red-700 text-white"
                        >
                          <span>⚠️</span>
                          <span>Zaległa składka ({feeLock?.overdueKk} kk)</span>
                        </Badge>
                      ) : isDateLocked ? (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 gap-1 font-medium"
                        >
                          <span>🔒</span>
                          <span>Zapisy od {unlockDatePl}</span>
                        </Badge>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <form onSubmit={handleSaveProperties} className="flex flex-col gap-4 my-2 max-w-xl bg-card border p-4 rounded-xl shadow-xs">
                        <FieldGroup>
                          <Field>
                            <FieldLabel htmlFor="edit-event-type">Kategoria</FieldLabel>
                            <div className="relative">
                              <select
                                id="edit-event-type"
                                value={editType}
                                onChange={(e) => {
                                  const newType = e.target.value as GuildEventType
                                  setEditType(newType)
                                  setEditColor(EVENT_TYPE_METADATA[newType].defaultColor)
                                }}
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
                            <FieldLabel htmlFor="edit-event-title">Nazwa</FieldLabel>
                            <Input
                              id="edit-event-title"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="np. Wieczorne V3 lub Wyprawa na Smoka"
                              required
                            />
                          </Field>

                          {!updateSeries ? (
                            <Field>
                              <FieldLabel htmlFor="edit-event-date">Data</FieldLabel>
                              <Input
                                id="edit-event-date"
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                required
                              />
                            </Field>
                          ) : null}

                          <div className="grid grid-cols-2 gap-3">
                            <Field>
                              <FieldLabel htmlFor="edit-event-start">Start</FieldLabel>
                              <Input
                                id="edit-event-start"
                                type="time"
                                value={editStartTime}
                                onChange={(e) => setEditStartTime(e.target.value)}
                                required
                              />
                            </Field>

                            <Field>
                              <FieldLabel htmlFor="edit-event-end">Koniec</FieldLabel>
                              <Input
                                id="edit-event-end"
                                type="time"
                                value={editEndTime}
                                onChange={(e) => setEditEndTime(e.target.value)}
                                required
                              />
                            </Field>
                          </div>

                          {EVENT_TYPE_METADATA[editType].mode === "party" ? (
                            <Field>
                              <FieldLabel htmlFor="edit-event-max">Limit miejsc</FieldLabel>
                              <Input
                                id="edit-event-max"
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
                            <FieldLabel htmlFor="edit-event-desc">Opis</FieldLabel>
                            <Input
                              id="edit-event-desc"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="np. Wymagane przepustki i buff smok"
                            />
                          </Field>

                          {/* Series toggle checkbox */}
                          <div className="flex items-center gap-2 pt-1 border-t">
                            <Checkbox
                              id="update-series"
                              checked={updateSeries}
                              onCheckedChange={(checked) => setUpdateSeries(Boolean(checked))}
                            />
                            <label htmlFor="update-series" className="text-xs font-medium cursor-pointer">
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
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-start flex-wrap justify-end">
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

                        {event.status === "active" ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleStatusChange("finished")}
                            disabled={pending}
                          >
                            Zakończ
                          </Button>
                        ) : null}
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={handleDelete}
                          disabled={pending}
                        >
                          Usuń
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Main Content: Interactive Spots or Roster Panel */}
              <div className="p-6 flex flex-col gap-6">
                {event.restrictedAccess ? (
                  <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-center gap-3 my-4">
                    <div className="h-12 w-12 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl">
                      🔒
                    </div>
                    <div className="flex flex-col gap-1 max-w-md">
                      <h3 className="font-heading font-bold text-base text-foreground">
                        Szczegóły widoczne tylko dla Grupy V3
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        To wydarzenie jest zarezerwowane dla stałej ekipy V3. Aby zobaczyć skład, zająć spot lub wziąć udział w akcji, musisz posiadać przypisaną rolę <strong>V3</strong> przez lidera gildii.
                      </p>
                    </div>
                  </div>
                ) : event.type === "v3" ? (
                  <div className="flex flex-col gap-4">
                    {/* User signup status banner if signed up */}
                    {mySignups.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {mySignups.map((signup) => (
                          <div
                            key={signup.signupId}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border ${colorPreset.cardBg} ${colorPreset.cardBorder}`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`${colorPreset.badgeClass} text-xs px-2.5 py-1 font-medium`}>
                                Twój spot: {positionLabel(signup.spot)} {signup.role ? `(${signup.role})` : ""}
                              </Badge>
                              {signup.characterName ? (
                                <Badge variant="outline" className="text-xs font-semibold gap-1 border-primary/30 text-primary">
                                  <span>👤</span>
                                  <span>{signup.characterName}</span>
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="xs"
                                variant="secondary"
                                className="text-xs h-7 gap-1 font-medium"
                                onClick={() =>
                                  setTransferModal({
                                    signupId: signup.signupId,
                                    spot: signup.spot,
                                    ownerNick: signup.characterName || signup.gameNick,
                                  })
                                }
                              >
                                <Users className="size-3" />
                                Przekaż spot (Zastępstwo)
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="text-xs text-destructive hover:text-destructive h-7"
                                onClick={() =>
                                  handleWithdrawClick({
                                    signupId: signup.signupId,
                                    userId: currentUserId,
                                    spot: signup.spot,
                                  })
                                }
                                disabled={pending}
                              >
                                Zwolnij spot
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Active yellow card penalty banner */}
                    {userPenalty?.hasPenalty ? (
                      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs shadow-xs">
                        <span className="text-lg shrink-0 select-none">🟨</span>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-sm flex items-center gap-2">
                            <span>Aktywna żółta kartka (Poziom {userPenalty.cardLevel})</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30 font-bold"
                            >
                              Kara do {userPenalty.expiresAtPl}
                            </Badge>
                          </span>
                          <span className="text-[11px] opacity-90 leading-relaxed">
                            Z powodu aktywnej żółtej kartki możesz zapisywać się na wydarzenia V3 <strong>tylko na {userPenalty.allowedAdvanceDays ?? 1} {userPenalty.allowedAdvanceDays === 1 ? "dzień" : "dni"} w przód</strong> (zamiast standardowych {normalAdvanceDays} dni). Powód: <em>„{userPenalty.reason}”</em>.
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Fee lock banner if user owes fee for previous week and grace period expired */}
                    {isFeeLocked ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300 text-xs shadow-xs">
                        <div className="flex items-start gap-3">
                          <span className="text-lg shrink-0 select-none">⚠️</span>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">
                              Zapisy zablokowane: Nieuregulowana składka ({feeLock?.overdueKk} kk)
                            </span>
                            <span className="text-[11px] opacity-90 leading-relaxed">
                              {feeLock?.reason ??
                                `Zalegasz ze składką za poprzedni tydzień (${feeLock?.overdueKk} kk). Minął termin ${feeLock?.settlementDays} dni na jej opłacenie (${feeLock?.deadlineDatePl}). Ureguluj składkę w zakładce Składki, aby móc zapisywać się na V3.`}
                            </span>
                          </div>
                        </div>
                        <Link
                          href="/skladki"
                          className="inline-flex items-center justify-center rounded-lg bg-destructive text-destructive-foreground px-3.5 py-1.5 text-xs font-semibold shrink-0 hover:bg-destructive/90 transition-colors shadow-xs self-start sm:self-center"
                        >
                          Przejdź do składek →
                        </Link>
                      </div>
                    ) : isDateLocked ? (
                      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs shadow-xs">
                        <span className="text-base shrink-0 select-none">🔒</span>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-sm">
                            Zapisy na ten event V3 ruszają na {maxDaysAhead} {maxDaysAhead === 1 ? "dzień" : "dni"} przed wydarzeniem (od godz. {signupOpenTime})
                          </span>
                          <span className="text-[11px] opacity-90 leading-relaxed">
                            {userPenalty?.hasPenalty
                              ? `Z powodu nałożonej żółtej kartki Twoje zapisy otwierają się dopiero ${maxDaysAhead} ${maxDaysAhead === 1 ? "dzień" : "dni"} przed wydarzeniem: `
                              : `Zapisy na wydarzenia są otwarte z wyprzedzeniem ${normalAdvanceDays} ${normalAdvanceDays === 1 ? "dnia" : "dni"}. Zapisy dla graczy zostaną otwarte: `}
                            <strong className="font-bold underline underline-offset-2">{unlockDatePl} o godz. {signupOpenTime}</strong>.
                            {isLeader ? " Jako lider możesz w razie potrzeby ręcznie zapisać gracza opcją '+ Wpisz'." : ""}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Multi-character switcher if user has multiple characters */}
                    {userCharacters.length > 1 ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border bg-muted/40 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>Postać do zapisu:</span>
                            <strong className="text-primary">{activeChar?.name}</strong>
                            {activeChar?.isMain ? (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600 dark:text-amber-400 gap-0.5 font-bold">
                                <Crown className="size-2.5" /> Główna
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground font-semibold">
                                Dodatkowa
                              </Badge>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {!isEventDay
                              ? "Dodatkowe postacie oraz 2. miejsce na ten sam event można zapisać wyłącznie w dniu wydarzenia."
                              : "Dzień wydarzenia: możesz zapisać drugą postać (maksymalnie 2 sloty na gracza)."}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {userCharacters.map((char) => {
                            const isSelected = activeChar?.id === char.id
                            const isSigned = mySignups.some(
                              (s) => s.characterId === char.id || s.characterName?.toLowerCase() === char.name.toLowerCase()
                            )
                            const isLockedChar = !char.isMain && !isEventDay

                            return (
                              <Button
                                key={char.id}
                                type="button"
                                size="xs"
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => setSelectedCharacterId(char.id)}
                                disabled={pending}
                                className={`h-7 text-xs gap-1.5 font-medium transition-all ${
                                  isSelected ? "shadow-xs ring-1 ring-primary/40 font-bold" : ""
                                }`}
                              >
                                {char.isMain ? <Crown className="size-3 text-amber-400" /> : null}
                                <span>{char.name}</span>
                                <span className="text-[9px] opacity-70">({char.isMain ? "Główna" : "Dodatkowa"})</span>
                                {isSigned ? (
                                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                                    Zapisany
                                  </Badge>
                                ) : isLockedChar ? (
                                  <span className="text-[10px]" title="Dostępny w dniu eventu">🔒</span>
                                ) : null}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Vertical list of spots - one under another */}
                    <div className="flex flex-col gap-2.5">
                      {V3_EVENT_SPOTS.map((spot) => {
                        const spotSignup = event.signups.find((s) => s.spot === spot.id)
                        const currentUserNick = allGuildUsers?.find((u) => u.id === currentUserId)?.gameNick
                        const isMine = Boolean(
                          spotSignup && (
                            spotSignup.userId === currentUserId ||
                            (currentUserNick && (
                              spotSignup.gameNick?.trim().toLowerCase() === currentUserNick.trim().toLowerCase() ||
                              spotSignup.userNick?.trim().toLowerCase() === currentUserNick.trim().toLowerCase()
                            ))
                          )
                        )
                        const canToggle = spotSignup && (isLeader || isMine)

                        const isCharSigned = activeChar
                          ? mySignups.some(
                              (s) =>
                                s.characterId === activeChar.id ||
                                s.characterName?.toLowerCase() === activeChar.name.toLowerCase()
                            )
                          : mySignups.length > 0

                        const isSpotSignupDisabled =
                          pending ||
                          isLocked ||
                          mySignups.length >= 2 ||
                          isCharSigned ||
                          Boolean(activeChar && !activeChar.isMain && !isEventDay) ||
                          Boolean(mySignups.length >= 1 && !isEventDay)

                        const spotButtonLabel = isFeeLocked
                          ? "Zablokowane (składka)"
                          : isDateLocked
                          ? "Zapisy zablokowane"
                          : mySignups.length >= 2
                          ? "Maks. 2 postacie"
                          : isCharSigned
                          ? `${activeChar?.name ?? "Postać"} już na evencie`
                          : activeChar && !activeChar.isMain && !isEventDay
                          ? "Dostępne w dniu eventu"
                          : mySignups.length >= 1 && !isEventDay
                          ? "2. postać w dniu eventu"
                          : mySignups.length === 1
                          ? `+ Zapisz 2. postać (${activeChar?.name ?? "2. postać"})`
                          : userCharacters.length > 1 && activeChar
                          ? `Zajmij (${activeChar.name})`
                          : "Zajmij spot"

                        return (
                          <div
                            key={spot.id}
                            className={`rounded-xl border transition-all p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              spotSignup
                                ? isMine
                                  ? "border-cyan-500/50 dark:border-cyan-500/50 bg-cyan-500/10 dark:bg-cyan-950/30 border-l-[3.5px] border-l-cyan-500 shadow-xs ring-1 ring-cyan-500/25"
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
                                  <span className={`font-heading text-sm leading-tight ${isMine ? "font-extrabold text-cyan-600 dark:text-cyan-400" : "font-bold"}`}>
                                    {spot.name}
                                  </span>
                                  {isMine ? (
                                    <Badge className="bg-cyan-600 hover:bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold text-[9px] h-4.5 px-1.5 shadow-xs">
                                      Twój spot
                                    </Badge>
                                  ) : spotSignup ? (
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
                                {spot.desc ? (
                                  <div className={`text-[11px] truncate ${spot.id === "R2_R3_KORYTARZ" ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                                    {spot.desc}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {/* Center / Details: Occupant info if signed up */}
                            {spotSignup ? (
                              <div className={`flex flex-1 items-center justify-between sm:justify-center gap-3 border px-3 py-1.5 rounded-lg text-xs ${isMine ? "bg-cyan-500/10 border-cyan-500/30" : "bg-background/70"}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`truncate ${isMine ? "text-cyan-700 dark:text-cyan-300 font-bold" : "font-semibold"}`}>
                                    {spotSignup.characterName || spotSignup.gameNick}
                                  </span>
                                  {spotSignup.userNick && spotSignup.characterName && spotSignup.userNick.toLowerCase() !== spotSignup.characterName.toLowerCase() ? (
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      ({spotSignup.userNick})
                                    </span>
                                  ) : null}
                                  {spotSignup.role ? (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-medium px-1.5 py-0 ${isMine ? "border-cyan-500/40 text-cyan-700 dark:text-cyan-300" : ""}`}
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
                                <div className="flex items-center gap-1.5">
                                  {(isMine || isLeader) && (
                                    <Button
                                      size="xs"
                                      variant="secondary"
                                      onClick={() =>
                                        setTransferModal({
                                          signupId: spotSignup.signupId,
                                          spot: spotSignup.spot,
                                          ownerNick: spotSignup.characterName || spotSignup.gameNick,
                                        })
                                      }
                                      disabled={pending}
                                      className="h-8 text-xs font-medium gap-1"
                                      title="Przekaż miejscówkę innemu graczowi (zastępstwo)"
                                    >
                                      <Users className="size-3" />
                                      Przekaż
                                    </Button>
                                  )}

                                  {isLeader || isMine ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleWithdrawClick({
                                          signupId: spotSignup.signupId,
                                          userId: spotSignup.userId,
                                          gameNick: spotSignup.characterName || spotSignup.gameNick,
                                          spot: spotSignup.spot,
                                        })
                                      }
                                      disabled={pending}
                                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                                    >
                                      {isLeader && !isMine ? "Wywal" : "Zwolnij"}
                                    </Button>
                                  ) : null}
                                </div>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    className={`h-8 text-xs font-semibold ${colorPreset.badgeClass} shadow-xs px-4`}
                                    onClick={() => handleSpotSignUp(spot.id, undefined, activeChar?.id)}
                                    disabled={isSpotSignupDisabled}
                                  >
                                    {spotButtonLabel}
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
                            Twój spot: {positionLabel(mySignup.spot)}
                          </Badge>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-xs text-destructive hover:text-destructive h-7"
                            onClick={() => handleWithdrawClick({ signupId: mySignup.signupId, userId: currentUserId, spot: mySignup.spot })}
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
                                      onClick={() => handleWithdrawClick({
                                        signupId: spotSignup.signupId,
                                        userId: spotSignup.userId,
                                        gameNick: spotSignup.gameNick,
                                        spot: spotSignup.spot,
                                      })}
                                      disabled={pending}
                                      className="text-muted-foreground hover:text-destructive hover:underline font-medium cursor-pointer"
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
                                    className="text-xs text-muted-foreground hover:text-destructive h-6 px-2 cursor-pointer"
                                    onClick={() => handleWithdrawClick({
                                      signupId: p.signupId,
                                      userId: p.userId,
                                      gameNick: p.gameNick,
                                      spot: p.spot,
                                    })}
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
                              onClick={() => handleWithdrawClick({ signupId: mySignup.signupId, userId: currentUserId, spot: mySignup.spot })}
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

                {/* 4. AUDIT LOG SECTION (Visible ONLY to Leaders/Admins) */}
                {isLeader ? (
                  <div className="mt-4 pt-4 border-t flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📜</span>
                        <span className="font-heading font-bold text-sm">Historia zmian i audyt</span>
                        <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                          Tylko Admin
                        </Badge>
                      </div>
                      {event.auditLogs && event.auditLogs.length > 0 ? (
                        <span className="text-xs text-muted-foreground font-mono">
                          {event.auditLogs.length} {event.auditLogs.length === 1 ? "wpis" : "wpisy/ów"}
                        </span>
                      ) : null}
                    </div>

                    {!event.auditLogs || event.auditLogs.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground bg-muted/10">
                        Brak zarejestrowanych operacji w historii tego wydarzenia.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                        {event.auditLogs.map((log) => {
                          const dateObj = new Date(log.createdAt)
                          const timeStr = dateObj.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                          const dateStr = dateObj.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })

                          let detailsObj: { isLessThan2Hours?: boolean; timeRemaining?: string; issuedYellowCard?: boolean } | null = null
                          if (log.details) {
                            try {
                              detailsObj = JSON.parse(log.details)
                            } catch {}
                          }

                          let badgeVariant: "default" | "secondary" | "outline" = "outline"
                          let badgeClass = ""
                          let actionLabel = ""
                          let content = null

                          switch (log.action) {
                            case "signup":
                              badgeClass = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              actionLabel = "Zapis"
                              content = (
                                <span>
                                  Gracz <strong className="text-foreground">{log.actorNick}</strong> zapisał się
                                  {log.spot ? <> na spot <strong className="text-foreground">{positionLabel(log.spot)}</strong></> : ""}
                                  {log.role ? ` (${log.role})` : ""}.
                                </span>
                              )
                              break
                            case "admin_assign":
                              badgeClass = "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                              actionLabel = "Wpisanie (Admin)"
                              content = (
                                <span>
                                  Admin <strong className="text-foreground">{log.actorNick}</strong> wpisał gracza{" "}
                                  <strong className="text-foreground">{log.targetUserNick || "gracza"}</strong>
                                  {log.spot ? <> na spot <strong className="text-foreground">{positionLabel(log.spot)}</strong></> : ""}.
                                </span>
                              )
                              break
                            case "withdraw":
                              badgeClass = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              actionLabel = "Wypisanie"
                              content = (
                                <div className="flex flex-col gap-1">
                                  <span>
                                    Gracz <strong className="text-foreground">{log.actorNick}</strong> zwolnił swój spot
                                    {log.spot ? <> <strong className="text-foreground">({positionLabel(log.spot)})</strong></> : ""}.
                                  </span>
                                  {detailsObj?.timeRemaining && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] h-4 px-1.5 font-medium ${
                                          detailsObj.isLessThan2Hours
                                            ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 font-bold"
                                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        }`}
                                      >
                                        {detailsObj.isLessThan2Hours ? "⚠️ < 2h do startu" : "✓ Bezpieczna rezygnacja (≥ 2h)"} ({detailsObj.timeRemaining})
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              )
                              break
                            case "admin_withdraw":
                              badgeClass = "bg-destructive/15 text-destructive border-destructive/30"
                              actionLabel = "Wypisanie (Admin)"
                              content = (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span>
                                      Admin <strong className="text-foreground">{log.actorNick}</strong> wypisał gracza{" "}
                                      <strong className="text-foreground">{log.targetUserNick || "gracza"}</strong>
                                      {log.spot ? <> ze spota <strong className="text-foreground">{positionLabel(log.spot)}</strong></> : ""}.
                                    </span>
                                    {detailsObj?.isLessThan2Hours !== undefined && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] h-4 px-1.5 ${
                                          detailsObj.isLessThan2Hours
                                            ? "bg-red-500/15 text-red-600 border-red-500/30 font-bold"
                                            : "bg-muted text-muted-foreground border-border"
                                        }`}
                                      >
                                        {detailsObj.isLessThan2Hours ? "⚠️ < 2h" : "≥ 2h"}
                                      </Badge>
                                    )}
                                    {detailsObj?.issuedYellowCard && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] h-4 px-1.5 bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 font-bold"
                                      >
                                        🟨 Żółta kartka
                                      </Badge>
                                    )}
                                  </div>
                                  {log.reason ? (
                                    <div className="text-[11px] bg-background/80 border rounded p-1.5 text-foreground italic mt-0.5">
                                      💬 Powód: <span className="font-normal not-italic">{log.reason}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground italic">
                                      (nie podano powodu)
                                    </span>
                                  )}
                                </div>
                              )
                              break
                            case "spot_transfer":
                              badgeClass = "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              actionLabel = "Przekazanie spota"
                              content = (
                                <div className="flex flex-col gap-1">
                                  <span>
                                    Gracz <strong className="text-foreground">{log.actorNick}</strong> przekazał spot{" "}
                                    {log.spot ? <strong className="text-foreground">({positionLabel(log.spot)})</strong> : ""}{" "}
                                    graczowi <strong className="text-foreground">{log.targetUserNick || "innemu graczowi"}</strong>.
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] h-4 px-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 font-medium"
                                    >
                                      ✓ Zastępstwo (slot obsadzony)
                                    </Badge>
                                    {detailsObj?.timeRemaining && (
                                      <span className="text-[10px] text-muted-foreground">
                                        • {detailsObj.timeRemaining}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                              break
                            case "yellow_card":
                              badgeClass = "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                              actionLabel = "Żółta kartka"
                              content = (
                                <div className="flex flex-col gap-0.5">
                                  <span>
                                    Admin <strong className="text-foreground">{log.actorNick}</strong> nadał żółtą kartkę graczowi{" "}
                                    <strong className="text-foreground">{log.targetUserNick || "graczowi"}</strong>.
                                  </span>
                                  {log.reason && (
                                    <span className="text-[11px] italic text-muted-foreground">
                                      💬 Powód: „{log.reason}”
                                    </span>
                                  )}
                                </div>
                              )
                              break
                            case "reschedule":
                              badgeClass = "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                              actionLabel = "Termin"
                              content = (
                                <span>
                                  Admin <strong className="text-foreground">{log.actorNick}</strong> zmienił termin wydarzenia.
                                </span>
                              )
                              break
                            default:
                              actionLabel = log.action
                              content = <span>Zaktualizowano wydarzenie przez {log.actorNick}.</span>
                          }

                          return (
                            <div
                              key={log.id}
                              className="rounded-lg border bg-muted/20 p-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs"
                            >
                              <div className="flex items-start gap-2.5">
                                <Badge variant={badgeVariant} className={`text-[10px] shrink-0 font-medium px-1.5 py-0 mt-0.5 ${badgeClass}`}>
                                  {actionLabel}
                                </Badge>
                                <div className="text-xs leading-relaxed">
                                  {content}
                                </div>
                              </div>
                              <span className="font-mono text-[10.5px] text-muted-foreground shrink-0 self-end sm:self-start">
                                {dateStr} {timeStr}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Withdraw Reason Dialog */}
      <Dialog
        open={adminWithdrawTarget !== null}
        onOpenChange={(op) => {
          if (!op) setAdminWithdrawTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>⚠️</span>
              <span>Wypisz gracza z wydarzenia</span>
            </DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz wypisać gracza{" "}
              <strong className="text-foreground">{adminWithdrawTarget?.userName}</strong>
              {adminWithdrawTarget?.spot ? (
                <> ze spota <strong className="text-foreground">{positionLabel(adminWithdrawTarget.spot)}</strong></>
              ) : ""}?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="admin-withdraw-reason" className="text-xs font-semibold">
                Powód wypisania (widoczny w audycie dla administracji)
              </FieldLabel>
              <Input
                id="admin-withdraw-reason"
                placeholder="np. brak obecności na DC, spóźnienie, zastępstwo..."
                value={adminWithdrawReason}
                onChange={(e) => setAdminWithdrawReason(e.target.value)}
                className="text-xs"
                autoFocus
              />
            </Field>

            {/* Checkbox to give yellow card */}
            <div className="flex flex-col gap-2 p-2.5 rounded-lg border bg-amber-500/10 border-amber-500/20 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-amber-800 dark:text-amber-300">
                <Checkbox
                  checked={adminGiveYellowCard}
                  onCheckedChange={(c) => setAdminGiveYellowCard(Boolean(c))}
                />
                <span>🟨 Nadaj żółtą kartkę temu graczowi</span>
              </label>

              {adminGiveYellowCard && (
                <div className="flex flex-col gap-1.5 pl-6 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Kara ograniczy zapisy gracza do 1 dnia w przód (stopień zostanie obliczony automatycznie: 3, 7 lub 14 dni).
                  </p>
                  <Field>
                    <FieldLabel htmlFor="admin-yellow-card-reason" className="text-[11px] font-medium">
                      Powód żółtej kartki (jeśli inny niż powód wypisania)
                    </FieldLabel>
                    <Input
                      id="admin-yellow-card-reason"
                      placeholder="Uzasadnienie żółtej kartki..."
                      value={adminYellowCardReason}
                      onChange={(e) => setAdminYellowCardReason(e.target.value)}
                      className="text-xs h-8"
                    />
                  </Field>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Ten wpis wraz z podanym powodem zostanie trwale zapisany w dzienniku zdarzeń (audycie) wydarzenia.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdminWithdrawTarget(null)}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={handleConfirmAdminWithdraw}
              className="cursor-pointer font-semibold"
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Wypisz gracza
            </Button>
          </DialogFooter>
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
              <div className="relative">
                <select
                  id="modal-leader-user"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer [color-scheme:light] dark:[color-scheme:dark] dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {allGuildUsers.map((u) => (
                    <option
                      key={u.id}
                      value={u.id}
                      className="bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100 py-1.5"
                    >
                      {u.gameNick}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <ChevronDown className="size-4 opacity-70" />
                </div>
              </div>
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
              {event?.recurrence && event.recurrence !== "none"
                ? `Wydarzenie "${event?.title}" jest częścią serii powtarzającej się. Co chcesz usunąć?`
                : `Czy na pewno chcesz usunąć wydarzenie "${event?.title}"? Tej operacji nie można cofnąć.`}
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
            {event?.recurrence && event.recurrence !== "none" && (
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

      {/* Spot Transfer Dialog */}
      {transferModal && (
        <SpotTransferDialog
          open={transferModal !== null}
          onOpenChange={(op) => {
            if (!op) setTransferModal(null)
          }}
          signupId={transferModal.signupId}
          currentSpot={transferModal.spot}
          currentOwnerNick={transferModal.ownerNick}
          allUsers={allGuildUsers}
          existingParticipantUserIds={event?.signups.map((s) => s.userId)}
          onTransferred={refreshDetails}
        />
      )}

      {/* Give Yellow Card Dialog */}
      {giveYellowCardTarget && (
        <GiveYellowCardDialog
          open={giveYellowCardTarget !== null}
          onOpenChange={(op) => {
            if (!op) setGiveYellowCardTarget(null)
          }}
          targetUserId={giveYellowCardTarget.userId}
          targetUserNick={giveYellowCardTarget.userNick}
          eventId={event?.id}
          onCardIssued={refreshDetails}
        />
      )}
    </>
  )
}
