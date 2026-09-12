"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  giveYellowCard,
  revokeYellowCard,
  updateYellowCardReason,
  type PenaltyHistoryItem,
} from "@/lib/actions/penalties"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { AlertTriangleIcon, Edit2Icon, PlusIcon, ShieldAlertIcon, Undo2Icon, ChevronDown } from "lucide-react"

export function AdminYellowCards({
  penalties,
  allUsers,
}: {
  penalties: PenaltyHistoryItem[]
  allUsers: { id: string; gameNick: string }[]
}) {
  const [pending, startTransition] = useTransition()

  // New penalty dialog
  const [newCardOpen, setNewCardOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [newReason, setNewReason] = useState("")

  // Edit reason dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editPenaltyId, setEditPenaltyId] = useState("")
  const [editReason, setEditReason] = useState("")

  function handleCreateCard(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUserId || !newReason.trim()) return

    startTransition(async () => {
      const res = await giveYellowCard({
        userId: selectedUserId,
        reason: newReason.trim(),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setNewCardOpen(false)
      setSelectedUserId("")
      setNewReason("")
    })
  }

  function openEditModal(penalty: PenaltyHistoryItem) {
    setEditPenaltyId(penalty.id)
    setEditReason(penalty.reason)
    setEditOpen(true)
  }

  function handleUpdateReason(e: React.FormEvent) {
    e.preventDefault()
    if (!editPenaltyId || !editReason.trim()) return

    startTransition(async () => {
      const res = await updateYellowCardReason({
        penaltyId: editPenaltyId,
        reason: editReason.trim(),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setEditOpen(false)
    })
  }

  function handleRevoke(penaltyId: string, userNick: string) {
    if (!confirm(`Czy na pewno chcesz zdjąć żółtą kartkę graczowi ${userNick}?`)) return

    startTransition(async () => {
      const res = await revokeYellowCard({ penaltyId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  const activeCount = penalties.filter((p) => p.isActive).length

  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🟨</span>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span>System kar: Żółte kartki</span>
                {activeCount > 0 && (
                  <Badge variant="secondary" className="font-mono text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {activeCount} aktywnych
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Przeglądaj nałożone żółte kartki, edytuj powody lub cofaj kary. Wymiar kar i wyprzedzenie zapisów konfigurujesz w sekcji powyżej.
              </CardDescription>
            </div>
          </div>

          <Button
            size="sm"
            className="text-xs h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold self-start sm:self-auto shadow-xs"
            onClick={() => {
              setSelectedUserId("")
              setNewReason("")
              setNewCardOpen(true)
            }}
          >
            <PlusIcon className="size-3.5" />
            Nadaj żółtą kartkę
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {penalties.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground italic">
            Brak zarejestrowanych żółtych kartek w gildii.
          </div>
        ) : (
          <div className="border rounded-xl divide-y overflow-hidden">
            {penalties.map((pen) => {
              return (
                <div
                  key={pen.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-3 transition-colors ${
                    pen.isActive ? "bg-amber-500/5 hover:bg-amber-500/10" : "bg-muted/10 opacity-75"
                  }`}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">
                        {pen.userNick}
                      </span>

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          pen.cardLevel === 1
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : pen.cardLevel === 2
                              ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40 font-bold"
                              : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 font-extrabold"
                        }`}
                      >
                        🟨 Poziom {pen.cardLevel} ({pen.durationDays} dni)
                      </Badge>

                      <Badge
                        variant={pen.isActive ? "default" : "secondary"}
                        className={`text-[10px] ${
                          pen.isActive
                            ? "bg-amber-600 hover:bg-amber-600 text-white"
                            : pen.revokedAt
                              ? "text-muted-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {pen.isActive
                          ? `Aktywna (do ${pen.expiresAtPl})`
                          : pen.revokedAt
                            ? "Zdjęta przez admina"
                            : "Wygasła"}
                      </Badge>
                    </div>

                    <div className="text-xs flex items-center gap-2 text-muted-foreground">
                      <span>
                        Powód: <strong className="text-foreground">{pen.reason}</strong>
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      Nadał: {pen.adminNick} • {pen.issuedAt.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Button
                      size="xs"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => openEditModal(pen)}
                    >
                      <Edit2Icon className="size-3" />
                      Edytuj powód
                    </Button>

                    {pen.isActive && (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                        onClick={() => handleRevoke(pen.id, pen.userNick)}
                        disabled={pending}
                      >
                        <Undo2Icon className="size-3" />
                        Zdejmij karę
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Give Yellow Card Modal */}
      <Dialog open={newCardOpen} onOpenChange={setNewCardOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCard}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>🟨</span>
                <span>Nadaj żółtą kartkę</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Wybierz gracza i podaj uzasadnienie. System automatycznie dopasuje stopień kary (3 / 7 / 14 dni).
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4 gap-3">
              <Field>
                <FieldLabel htmlFor="select-user">Wybierz gracza</FieldLabel>
                <div className="relative">
                  <select
                    id="select-user"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer [color-scheme:light] dark:[color-scheme:dark] dark:bg-zinc-900 dark:text-zinc-100"
                    required
                  >
                    <option
                      value=""
                      className="bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      -- Wybierz gracza z gildii --
                    </option>
                    {allUsers
                      .slice()
                      .sort((a, b) => a.gameNick.localeCompare(b.gameNick, "pl"))
                      .map((u) => (
                        <option
                          key={u.id}
                          value={u.id}
                          className="bg-background text-foreground dark:bg-zinc-900 dark:text-zinc-100"
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

              <Field>
                <FieldLabel htmlFor="create-reason">Powód kary</FieldLabel>
                <Input
                  id="create-reason"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="np. Brak obecności na slocie 14:00..."
                  required
                  className="text-xs"
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewCardOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                disabled={pending || !selectedUserId || !newReason.trim()}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Nadaj kartkę
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Reason Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateReason}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2Icon className="size-4 text-amber-500" />
                <span>Edycja powodu kary</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Możesz w dowolnym momencie zaktualizować treść wyjaśnienia żółtej kartki.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="edit-card-reason">Powód / wyjaśnienie</FieldLabel>
                <Input
                  id="edit-card-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  required
                  className="text-xs"
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                disabled={pending || !editReason.trim()}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Zapisz powód
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
