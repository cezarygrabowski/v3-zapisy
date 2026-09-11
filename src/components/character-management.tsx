"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  addCharacter,
  deleteCharacter,
  setMainCharacter,
  updateCharacter,
  type CharacterItem,
} from "@/lib/actions/characters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { ShieldAlert, Plus, Crown, Trash2, Edit2, Check, User } from "lucide-react"

export function CharacterManagement({
  initialCharacters,
}: {
  initialCharacters: CharacterItem[]
}) {
  const [characters, setCharacters] = useState<CharacterItem[]>(initialCharacters)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingChar, setEditingChar] = useState<CharacterItem | null>(null)

  // Form states
  const [newName, setNewName] = useState("")
  const [newPlaystyle, setNewPlaystyle] = useState<"pvp" | "pvm">("pvm")

  const [editName, setEditName] = useState("")
  const [editPlaystyle, setEditPlaystyle] = useState<"pvp" | "pvm">("pvm")

  const [pending, startTransition] = useTransition()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await addCharacter({ name: newName, playstyle: newPlaystyle })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      if (res.data?.character) {
        setCharacters((prev) => [...prev, res.data.character])
      }
      setNewName("")
      setNewPlaystyle("pvm")
      setIsAddOpen(false)
    })
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingChar) return
    startTransition(async () => {
      const res = await updateCharacter({
        characterId: editingChar.id,
        name: editName,
        playstyle: editPlaystyle,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === editingChar.id ? { ...c, name: editName, playstyle: editPlaystyle } : c
        )
      )
      setEditingChar(null)
    })
  }

  function handleSetMain(char: CharacterItem) {
    if (char.isMain) return
    startTransition(async () => {
      const res = await setMainCharacter({ characterId: char.id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setCharacters((prev) =>
        prev.map((c) => ({
          ...c,
          isMain: c.id === char.id,
        }))
      )
    })
  }

  function handleDelete(char: CharacterItem) {
    if (char.isMain) {
      toast.error("Nie możesz usunąć postaci głównej.")
      return
    }
    if (!confirm(`Czy na pewno chcesz usunąć postać „${char.name}”?`)) return

    startTransition(async () => {
      const res = await deleteCharacter({ characterId: char.id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setCharacters((prev) => prev.filter((c) => c.id !== char.id))
    })
  }

  return (
    <Card className="max-w-2xl border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <span>🗡️</span>
              <span>Twoje postacie w grze</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Zarządzaj swoimi postaciami. Postać główna zapisuje się z wyprzedzeniem, natomiast dodatkowe postacie mogą zapisywać się wyłącznie w dniu wydarzenia.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0 self-start sm:self-auto text-xs"
            onClick={() => {
              setNewName("")
              setNewPlaystyle("pvm")
              setIsAddOpen(true)
            }}
            disabled={pending}
          >
            <Plus className="size-3.5" />
            Dodaj kolejną postać
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-2 flex flex-col gap-3">
        {/* Anty-monopol notice banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">Zasada zapisów dla dodatkowych postaci:</span>
            <span className="leading-relaxed">
              Aby uniknąć sytuacji, w której jedna osoba zajmuje dwa miejsca z wyprzedzeniem i blokuje innych graczy, <strong>dodatkowe postacie mogą zapisywać się na wydarzenia wyłącznie w dniu ich rozpoczęcia</strong>.
            </span>
          </div>
        </div>

        {/* Character list */}
        <div className="flex flex-col divide-y divide-border/60 border rounded-lg overflow-hidden bg-card">
          {characters.map((char) => (
            <div
              key={char.id}
              className="flex items-center justify-between p-3 gap-3 transition-colors hover:bg-muted/10"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {char.isMain ? (
                  <span className="flex size-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0" title="Postać główna">
                    <Crown className="size-4" />
                  </span>
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0" title="Postać dodatkowa">
                    <User className="size-4" />
                  </span>
                )}

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-sm truncate">
                      {char.name}
                    </span>
                    {char.isMain ? (
                      <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 text-[10px] h-4.5 px-1.5 font-bold">
                        Główna
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground h-4.5 px-1.5 font-medium">
                        Dodatkowa
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4.5 px-1.5 font-semibold ${
                        char.playstyle === "pvp"
                          ? "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                          : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                      }`}
                    >
                      {char.playstyle.toUpperCase()} · {char.playstyle === "pvp" ? "3 kk" : "7 kk"}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {char.isMain
                      ? "Standardowe zapisy z wyprzedzeniem (np. 2 dni przed)"
                      : "Zapisy dozwolone wyłącznie w dniu wydarzenia"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!char.isMain && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                    title="Ustaw tę postać jako główną (Main)"
                    onClick={() => handleSetMain(char)}
                    disabled={pending}
                  >
                    <Crown className="size-3.5 mr-1 text-amber-500" />
                    Ustaw jako główną
                  </Button>
                )}

                <Button
                  size="xs"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Edytuj postać"
                  onClick={() => {
                    setEditingChar(char)
                    setEditName(char.name)
                    setEditPlaystyle(char.playstyle)
                  }}
                  disabled={pending}
                >
                  <Edit2 className="size-3.5" />
                </Button>

                {!char.isMain && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Usuń postać"
                    onClick={() => handleDelete(char)}
                    disabled={pending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Modal: Add Additional Character */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj kolejną postać</DialogTitle>
            <DialogDescription className="text-xs">
              Dodaj drugą postać do swojego konta. Będziesz mógł wybrać ją przy zapisie na wydarzenia w dniu ich trwania.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdd} className="flex flex-col gap-4 py-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-character-name">Nick postaci w grze</FieldLabel>
                <Input
                  id="new-character-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="np. DropNinja lub Buffek"
                  maxLength={24}
                  required
                  autoFocus
                />
              </Field>

              <Field>
                <FieldLabel>Typ postaci</FieldLabel>
                <ToggleGroup
                  value={[newPlaystyle]}
                  onValueChange={(val) => {
                    const next = val[0] as "pvp" | "pvm" | undefined
                    if (next) setNewPlaystyle(next)
                  }}
                  spacing={2}
                >
                  <ToggleGroupItem value="pvp">PVP · 3 kk</ToggleGroupItem>
                  <ToggleGroupItem value="pvm">PVM · 7 kk</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription className="text-xs">
                  Wysokość składki za wstęp jest naliczana według typu postaci, którą wchodzisz na rajd.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button type="submit" size="sm" disabled={pending || !newName.trim()}>
                {pending ? <Spinner className="size-3.5" /> : <Plus className="size-3.5" />}
                Dodaj postać
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Character */}
      <Dialog open={Boolean(editingChar)} onOpenChange={(open) => !open && setEditingChar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edytuj postać</DialogTitle>
            <DialogDescription className="text-xs">
              Zmień nick w grze lub typ postaci.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="flex flex-col gap-4 py-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="edit-character-name">Nick postaci w grze</FieldLabel>
                <Input
                  id="edit-character-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={24}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>Typ postaci</FieldLabel>
                <ToggleGroup
                  value={[editPlaystyle]}
                  onValueChange={(val) => {
                    const next = val[0] as "pvp" | "pvm" | undefined
                    if (next) setEditPlaystyle(next)
                  }}
                  spacing={2}
                >
                  <ToggleGroupItem value="pvp">PVP · 3 kk</ToggleGroupItem>
                  <ToggleGroupItem value="pvm">PVM · 7 kk</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingChar(null)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button type="submit" size="sm" disabled={pending || !editName.trim()}>
                {pending ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
                Zapisz zmiany
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
