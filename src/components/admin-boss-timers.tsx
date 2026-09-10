"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  createCustomTimer,
  createTimerCategory,
  deleteCustomTimer,
  deleteTimerCategory,
  updateCustomTimer,
} from "@/lib/actions/timers"
import type { TimerCategoryData } from "@/lib/timers-queries"
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
import { ClockIcon, Edit2Icon, PlusIcon, Trash2Icon } from "lucide-react"

export function AdminBossTimers({
  categories,
}: {
  categories: TimerCategoryData[]
}) {
  const [pending, startTransition] = useTransition()

  // New map dialog
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatIcon, setNewCatIcon] = useState("🗺️")

  // New boss dialog
  const [newBossOpen, setNewBossOpen] = useState(false)
  const [bossCategoryId, setBossCategoryId] = useState("")
  const [bossName, setBossName] = useState("")
  const [bossChannels, setBossChannels] = useState(5)
  const [bossRespawnMin, setBossRespawnMin] = useState(48)
  const [bossRespawnMax, setBossRespawnMax] = useState(52)
  const [bossNotes, setBossNotes] = useState("")

  // Edit boss dialog
  const [editBossOpen, setEditBossOpen] = useState(false)
  const [editBossId, setEditBossId] = useState("")
  const [editBossName, setEditBossName] = useState("")
  const [editBossChannels, setEditBossChannels] = useState(5)
  const [editBossRespawnMin, setEditBossRespawnMin] = useState(48)
  const [editBossRespawnMax, setEditBossRespawnMax] = useState(52)
  const [editBossNotes, setEditBossNotes] = useState("")

  function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return
    startTransition(async () => {
      const res = await createTimerCategory({
        name: newCatName.trim(),
        icon: newCatIcon.trim() || "🗺️",
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setNewCatOpen(false)
      setNewCatName("")
      setNewCatIcon("🗺️")
    })
  }

  function handleDeleteCategory(catId: string, catName: string) {
    if (!confirm(`Czy na pewno chcesz usunąć mapę „${catName}” wraz ze wszystkimi jej timerami?`)) {
      return
    }
    startTransition(async () => {
      const res = await deleteTimerCategory(catId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  function openAddBossModal(catId: string) {
    setBossCategoryId(catId)
    setBossName("")
    setBossChannels(5)
    setBossRespawnMin(48)
    setBossRespawnMax(52)
    setBossNotes("")
    setNewBossOpen(true)
  }

  function handleCreateBoss(e: React.FormEvent) {
    e.preventDefault()
    if (!bossName.trim() || !bossCategoryId) return
    startTransition(async () => {
      const res = await createCustomTimer({
        categoryId: bossCategoryId,
        name: bossName.trim(),
        channelsCount: Number(bossChannels) || 5,
        respawnMinMinutes: Number(bossRespawnMin) || 48,
        respawnMaxMinutes: Number(bossRespawnMax) || 52,
        notes: bossNotes.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setNewBossOpen(false)
    })
  }

  function openEditBossModal(timer: {
    id: string
    name: string
    channelsCount: number
    respawnMinMinutes: number
    respawnMaxMinutes: number
    notes: string | null
  }) {
    setEditBossId(timer.id)
    setEditBossName(timer.name)
    setEditBossChannels(timer.channelsCount)
    setEditBossRespawnMin(timer.respawnMinMinutes)
    setEditBossRespawnMax(timer.respawnMaxMinutes)
    setEditBossNotes(timer.notes || "")
    setEditBossOpen(true)
  }

  function handleUpdateBoss(e: React.FormEvent) {
    e.preventDefault()
    if (!editBossId || !editBossName.trim()) return
    startTransition(async () => {
      const res = await updateCustomTimer({
        timerId: editBossId,
        name: editBossName.trim(),
        channelsCount: Number(editBossChannels) || 5,
        respawnMinMinutes: Number(editBossRespawnMin) || 1,
        respawnMaxMinutes: Number(editBossRespawnMax) || 1,
        notes: editBossNotes.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setEditBossOpen(false)
    })
  }

  function handleDeleteBoss(timerId: string, timerName: string) {
    if (!confirm(`Czy na pewno chcesz usunąć bossa „${timerName}”?`)) return
    startTransition(async () => {
      const res = await deleteCustomTimer(timerId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⏱️</span>
            <div>
              <CardTitle className="text-base font-semibold">
                Konfiguracja okienek bossów i map
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Ustawiaj okienka respu (od – do w minutach), liczbę kanałów CH oraz notatki dla poszczególnych bossów na wszystkich mapach.
              </CardDescription>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5 self-start sm:self-auto"
            onClick={() => setNewCatOpen(true)}
          >
            <PlusIcon className="size-3.5" />
            Dodaj nową mapę
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground italic">
            Brak zdefiniowanych map i bossów. Kliknij „Dodaj nową mapę”, aby zacząć.
          </div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="flex flex-col rounded-xl border bg-card/60 overflow-hidden shadow-xs"
            >
              {/* Category Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>
                  <h3 className="font-heading text-sm font-bold">{cat.name}</h3>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {cat.timers.length} {cat.timers.length === 1 ? "boss" : "bossów"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => openAddBossModal(cat.id)}
                  >
                    <PlusIcon className="size-3" />
                    Dodaj bossa
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    disabled={pending}
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Bosses Table / List */}
              <div className="divide-y divide-border/60">
                {cat.timers.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground italic text-center">
                    Brak bossów na tej mapie. Kliknij „Dodaj bossa”.
                  </div>
                ) : (
                  cat.timers.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-foreground">
                            {t.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                          >
                            <ClockIcon className="size-2.5 mr-1" />
                            Okno respu: {t.respawnMinMinutes} min – {t.respawnMaxMinutes} min
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {t.channelsCount} CH
                          </Badge>
                        </div>

                        {t.notes && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            📌 {t.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => openEditBossModal(t)}
                        >
                          <Edit2Icon className="size-3" />
                          Edytuj okno
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                          onClick={() => handleDeleteBoss(t.id, t.name)}
                          disabled={pending}
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>

      {/* New Map Dialog */}
      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent>
          <form onSubmit={handleCreateCategory}>
            <DialogHeader>
              <DialogTitle>Dodaj nową mapę / krainę</DialogTitle>
              <DialogDescription>
                Utwórz nową kategorię mapy, do której będziesz przypisywać bossy i timery.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="cat-name">Nazwa mapy</FieldLabel>
                <Input
                  id="cat-name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="np. Loch Pająków V2, Dolina Seungryong..."
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cat-icon">Ikona (emoji)</FieldLabel>
                <Input
                  id="cat-icon"
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  placeholder="np. 🌲, ⛩️, 🌋, ❄️, 🕸️..."
                  className="w-24 text-center text-lg"
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewCatOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={pending || !newCatName.trim()}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Dodaj mapę
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Boss Dialog */}
      <Dialog open={newBossOpen} onOpenChange={setNewBossOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateBoss}>
            <DialogHeader>
              <DialogTitle>Dodaj nowego bossa</DialogTitle>
              <DialogDescription>
                Wprowadź parametry respawnu oraz liczbę kanałów dla nowego bossa.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4 gap-3">
              <Field>
                <FieldLabel htmlFor="boss-name">Nazwa bossa</FieldLabel>
                <Input
                  id="boss-name"
                  value={bossName}
                  onChange={(e) => setBossName(e.target.value)}
                  placeholder="np. Baronówna Pająków, Królowa Pająków..."
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="boss-min">Respawn MIN (min)</FieldLabel>
                  <Input
                    id="boss-min"
                    type="number"
                    min={1}
                    max={1440}
                    value={bossRespawnMin}
                    onChange={(e) => setBossRespawnMin(Number(e.target.value))}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="boss-max">Respawn MAX (min)</FieldLabel>
                  <Input
                    id="boss-max"
                    type="number"
                    min={1}
                    max={1440}
                    value={bossRespawnMax}
                    onChange={(e) => setBossRespawnMax(Number(e.target.value))}
                    required
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="boss-channels">Liczba kanałów (CH)</FieldLabel>
                <Input
                  id="boss-channels"
                  type="number"
                  min={1}
                  max={9}
                  value={bossChannels}
                  onChange={(e) => setBossChannels(Number(e.target.value))}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="boss-notes">Notatka / lokalizacja (opcjonalnie)</FieldLabel>
                <Input
                  id="boss-notes"
                  value={bossNotes}
                  onChange={(e) => setBossNotes(e.target.value)}
                  placeholder="np. Środek komnaty, resp co 1h"
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewBossOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={pending || !bossName.trim()}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Zapisz bossa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Boss Dialog */}
      <Dialog open={editBossOpen} onOpenChange={setEditBossOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateBoss}>
            <DialogHeader>
              <DialogTitle>Edycja okna i parametrów bossa</DialogTitle>
              <DialogDescription>
                Zmień okienko czasowe odrodzenia bossa, liczbę CH lub notatki.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4 gap-3">
              <Field>
                <FieldLabel htmlFor="edit-boss-name">Nazwa bossa</FieldLabel>
                <Input
                  id="edit-boss-name"
                  value={editBossName}
                  onChange={(e) => setEditBossName(e.target.value)}
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="edit-boss-min">Respawn MIN (min)</FieldLabel>
                  <Input
                    id="edit-boss-min"
                    type="number"
                    min={1}
                    max={1440}
                    value={editBossRespawnMin}
                    onChange={(e) => setEditBossRespawnMin(Number(e.target.value))}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="edit-boss-max">Respawn MAX (min)</FieldLabel>
                  <Input
                    id="edit-boss-max"
                    type="number"
                    min={1}
                    max={1440}
                    value={editBossRespawnMax}
                    onChange={(e) => setEditBossRespawnMax(Number(e.target.value))}
                    required
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="edit-boss-channels">Liczba kanałów (CH)</FieldLabel>
                <Input
                  id="edit-boss-channels"
                  type="number"
                  min={1}
                  max={9}
                  value={editBossChannels}
                  onChange={(e) => setEditBossChannels(Number(e.target.value))}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-boss-notes">Notatka / lokalizacja</FieldLabel>
                <Input
                  id="edit-boss-notes"
                  value={editBossNotes}
                  onChange={(e) => setEditBossNotes(e.target.value)}
                  placeholder="Wskazówki dla graczy..."
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditBossOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button type="submit" disabled={pending || !editBossName.trim()}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Zapisz zmiany
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
