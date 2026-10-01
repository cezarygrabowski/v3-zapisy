"use client"

import { useState, useTransition, type FormEvent } from "react"
import { Bell, Check, Clock, Pencil, Plus, Trash2, Volume2, VolumeX } from "lucide-react"
import { toast } from "sonner"
import { useAlerts } from "@/components/alerts-provider"
import { saveAlertTimer, completeAlertTimer, deleteAlertTimer } from "@/lib/actions/alerts"
import type { ActionResult } from "@/lib/actions/result"
import { formatCountdown, type AlertTimer } from "@/lib/alert-timer-types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function PersonalAlerts({ characters }: { characters: { id: string; name: string }[] }) {
  const { timers, now, soundEnabled, toggleSound } = useAlerts()
  const [pending, startTransition] = useTransition()
  const [editor, setEditor] = useState<AlertTimer | "new" | null>(null)
  const [deleting, setDeleting] = useState<AlertTimer | null>(null)
  const [name, setName] = useState("")
  const [characterId, setCharacterId] = useState("general")
  const [hours, setHours] = useState("24")
  const [minutes, setMinutes] = useState("0")
  const [startNow, setStartNow] = useState(false)
  const [filter, setFilter] = useState("all")
  const sorted = [...timers].sort((a, b) => a.readyAt - b.readyAt || a.name.localeCompare(b.name, "pl"))
  const ready = sorted.filter((timer) => timer.readyAt <= now)
  const visible = sorted.filter((timer) => filter === "all" || (filter === "general" ? !timer.characterId : timer.characterId === filter))

  function openEditor(timer: AlertTimer | "new") {
    setEditor(timer)
    setName(timer === "new" ? "Biolog" : timer.name)
    setCharacterId(timer === "new" ? characters[0]?.id ?? "general" : timer.characterId ?? "general")
    const interval = timer === "new" ? 1440 : timer.intervalMinutes
    setHours(String(Math.floor(interval / 60)))
    setMinutes(String(interval % 60))
    setStartNow(false)
  }

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) { toast.error(result.error); return }
        if (result.message) toast.success(result.message)
        after?.()
      } catch {
        toast.error("Nie udało się zapisać zmiany. Spróbuj ponownie.")
      }
    })
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const h = Number(hours)
    const m = Number(minutes)
    if (!Number.isInteger(h) || h < 0 || !Number.isInteger(m) || m < 0 || m > 59 || h * 60 + m < 1 || h * 60 + m > 525600) {
      toast.error("Podaj czas od 1 minuty do 365 dni.")
      return
    }
    run(() => saveAlertTimer({
      id: editor && editor !== "new" ? editor.id : undefined,
      name, characterId: characterId === "general" ? null : characterId,
      intervalMinutes: h * 60 + m, startNow,
    }), () => setEditor(null))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold">Alerty</h1>
          <p className="text-sm text-muted-foreground">Biolog, księgi i własne przypomnienia — wszystkie postacie w jednym miejscu.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleSound} aria-pressed={soundEnabled}>
            {soundEnabled ? <Volume2 data-icon="inline-start" /> : <VolumeX data-icon="inline-start" />}
            Dźwięk: {soundEnabled ? "włączony" : "wyłączony"}
          </Button>
          <Button onClick={() => openEditor("new")}><Plus data-icon="inline-start" />Dodaj timer</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge>{ready.length} alertów</Badge>
        <Badge variant="secondary">{timers.length - ready.length} w odliczaniu</Badge>
        <p className="text-xs text-muted-foreground">Alert pozostaje aktywny, dopóki nie klikniesz „Wykonano”. Powiadomienia działają przy otwartej stronie.</p>
      </div>

      <Field className="max-w-xs">
        <FieldLabel htmlFor="alert-filter">Postać</FieldLabel>
        <Select items={[{ value: "all", label: "Wszystkie postacie" }, { value: "general", label: "Timery ogólne" }, ...characters.map((character) => ({ value: character.id, label: character.name }))]} value={filter} onValueChange={(value) => setFilter(value ?? "all")}>
          <SelectTrigger id="alert-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="all">Wszystkie postacie</SelectItem>
            <SelectItem value="general">Timery ogólne</SelectItem>
            {characters.map((character) => <SelectItem key={character.id} value={character.id}>{character.name}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
      </Field>

      {!visible.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Bell /></EmptyMedia>
            <EmptyTitle>{timers.length ? "Brak timerów dla tej postaci" : "Twoja kolejka zaczyna się tutaj"}</EmptyTitle>
            <EmptyDescription>Dodaj biologa, księgę umiejętności lub dowolną czynność i ustaw czas oczekiwania.</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => openEditor("new")}><Plus data-icon="inline-start" />Dodaj timer</Button>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((timer) => {
            const isReady = timer.readyAt <= now
            return (
              <Card key={timer.id} className={isReady ? "border-l-4 border-primary" : ""}>
                <CardHeader>
                  <CardDescription>{timer.characterName ?? "Timer ogólny"}</CardDescription>
                  <CardTitle>{timer.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={isReady ? "default" : "secondary"}>{isReady ? <Bell data-icon="inline-start" /> : <Clock data-icon="inline-start" />}{isReady ? "Alerty" : "Odliczanie"}</Badge>
                    <span className="font-mono text-2xl tabular-nums" aria-label={isReady ? "Timer gotowy" : "Pozostały czas"}>{isReady ? "Gotowe" : formatCountdown(timer.readyAt, now)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isReady ? "Termin: " : "Następna kolejka: "}
                    <time dateTime={new Date(timer.readyAt).toISOString()}>{new Date(timer.readyAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                    {" · co "}{Math.floor(timer.intervalMinutes / 60) ? `${Math.floor(timer.intervalMinutes / 60)} godz. ` : ""}{timer.intervalMinutes % 60 ? `${timer.intervalMinutes % 60} min` : ""}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button className="flex-1" variant={isReady ? "default" : "outline"} disabled={pending} onClick={() => run(() => completeAlertTimer(timer.id))}>
                    <Check data-icon="inline-start" />Wykonano
                  </Button>
                  <Button variant="ghost" size="icon" disabled={pending} aria-label={`Edytuj ${timer.name}`} onClick={() => openEditor(timer)}><Pencil /></Button>
                  <Button variant="ghost" size="icon" disabled={pending} aria-label={`Usuń ${timer.name}`} onClick={() => setDeleting(timer)}><Trash2 /></Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open && !pending) setEditor(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor === "new" ? "Dodaj timer" : "Edytuj timer"}</DialogTitle>
            <DialogDescription>Ustaw czas zgodny z zasadami serwera. „Wykonano” liczy kolejną kolejkę od chwili kliknięcia.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="timer-name">Nazwa czynności</FieldLabel>
                <Input id="timer-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Biolog, Księga — Aura, Dungeon…" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setName("Biolog")}>Biolog</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setName("Księga umiejętności")}>Księga umiejętności</Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="timer-character">Postać</FieldLabel>
                <Select items={[{ value: "general", label: "Ogólny — bez postaci" }, ...characters.map((character) => ({ value: character.id, label: character.name }))]} value={characterId} onValueChange={(value) => setCharacterId(value ?? "general")}>
                  <SelectTrigger id="timer-character"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    <SelectItem value="general">Ogólny — bez postaci</SelectItem>
                    {characters.map((character) => <SelectItem key={character.id} value={character.id}>{character.name}</SelectItem>)}
                  </SelectGroup></SelectContent>
                </Select>
              </Field>
              <FieldGroup className="flex-row">
                <Field>
                  <FieldLabel htmlFor="timer-hours">Godziny</FieldLabel>
                  <Input id="timer-hours" type="number" min={0} max={8760} step={1} value={hours} onChange={(event) => setHours(event.target.value)} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="timer-minutes">Minuty</FieldLabel>
                  <Input id="timer-minutes" type="number" min={0} max={59} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
                </Field>
              </FieldGroup>
              {editor === "new" ? (
                <Field orientation="horizontal">
                  <Checkbox id="timer-start" checked={startNow} onCheckedChange={(checked) => setStartNow(checked === true)} />
                  <FieldLabel htmlFor="timer-start">Rozpocznij odliczanie teraz</FieldLabel>
                </Field>
              ) : <FieldDescription>Zmiana czasu przeliczy termin od ostatniego wykonania.</FieldDescription>}
              {editor === "new" && !startNow ? <FieldDescription>Timer od razu pojawi się w alertach. Kliknij „Wykonano”, gdy wykonasz czynność.</FieldDescription> : null}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setEditor(null)}>Anuluj</Button>
              <Button type="submit" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz timer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !pending) setDeleting(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Usuń timer</DialogTitle><DialogDescription>Usunąć „{deleting?.name}”{deleting?.characterName ? ` dla ${deleting.characterName}` : ""}?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setDeleting(null)}>Anuluj</Button>
            <Button variant="destructive" disabled={pending} onClick={() => { if (deleting) run(() => deleteAlertTimer(deleting.id), () => setDeleting(null)) }}>Usuń timer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
