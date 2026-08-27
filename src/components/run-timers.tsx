"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Volume1, Volume2, VolumeX } from "lucide-react"
import { syncRunTimer } from "@/lib/actions/run"
import { formatTimeWarsaw } from "@/lib/dates"
import type { RunSyncState } from "@/lib/queries"
import { playTimerSound, type TimerSoundType } from "@/lib/sound"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"

const COCOON_MS = 60 * 60 * 1000
const NETS_MS = 3 * 60 * 1000
const QUEEN_FIGHT_MS = 5 * 60 * 1000
const QUEEN_EARLY_MS = 40 * 60 * 1000
const QUEEN_LATE_MS = 2 * 60 * 60 * 1000

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function formatRemain(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

function askNotify() {
  if (typeof Notification === "undefined") return
  if (Notification.permission === "default") {
    void Notification.requestPermission()
  }
}

function ping(title: string, body: string) {
  toast.message(title, { description: body })
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body })
  }
}

function LoopTimer({
  title,
  description,
  periodMs,
  sync,
  pingTitle,
  pingBody,
  soundType,
  soundEnabled,
  onToggleSound,
  volume,
  onSync,
  pending,
}: {
  title: string
  description: string
  periodMs: number
  sync: RunSyncState | undefined
  pingTitle: string
  pingBody: string
  soundType: TimerSoundType
  soundEnabled: boolean
  onToggleSound: (checked: boolean) => void
  volume: number
  onSync: (time: string) => void
  pending: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  const prevCycle = useRef<number | null>(null)
  const syncedAt = sync ? new Date(sync.syncedAt).getTime() : null

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    prevCycle.current = null
  }, [sync?.syncedAt])

  const elapsed = syncedAt == null ? null : now - syncedAt
  const cycle = elapsed == null ? null : Math.floor(Math.max(0, elapsed) / periodMs)
  const remaining =
    elapsed == null
      ? null
      : elapsed < 0
        ? -elapsed
        : periodMs - (elapsed % periodMs)

  useEffect(() => {
    if (cycle == null) return
    if (prevCycle.current !== null && cycle !== prevCycle.current) {
      ping(pingTitle, pingBody)
      if (soundEnabled) {
        playTimerSound(soundType, volume / 100)
      }
    }
    prevCycle.current = cycle
  }, [cycle, pingBody, pingTitle, soundEnabled, soundType, volume])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground select-none">
            <span className="hidden sm:inline">Dźwięk</span>
            <Switch
              size="sm"
              checked={soundEnabled}
              onCheckedChange={onToggleSound}
              aria-label={`Dźwięk powiadomienia dla ${title}`}
            />
          </label>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="font-mono text-3xl tabular-nums">
          {remaining == null ? "—" : formatRemain(remaining)}
        </p>
        <p className="text-xs text-muted-foreground">
          {sync ? `Sync ${sync.syncedAtLabel}` : "Brak synchronizacji"}
        </p>
        <SyncButton pending={pending} onSync={onSync} />
      </CardContent>
    </Card>
  )
}

function QueenTimer({
  lastKill,
  nextQueen,
  soundEnabled,
  onToggleSound,
  volume,
}: {
  lastKill: { at: string; label: string } | null
  nextQueen: {
    nicks: string[]
    queens: number
    party: { nick: string; queens: number }[]
  }
  soundEnabled: boolean
  onToggleSound: (checked: boolean) => void
  volume: number
}) {
  const [now, setNow] = useState(() => Date.now())
  const prevPhase = useRef<string | null>(null)
  const syncedAt = lastKill ? new Date(lastKill.at).getTime() : null

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    prevPhase.current = null
  }, [lastKill?.at])

  const appearedAt = syncedAt == null ? null : syncedAt - QUEEN_FIGHT_MS
  const earlyAt = appearedAt == null ? null : appearedAt + QUEEN_EARLY_MS
  const lateAt = appearedAt == null ? null : appearedAt + QUEEN_LATE_MS
  const phase =
    syncedAt == null
      ? "none"
      : now < earlyAt!
        ? "wait"
        : now <= lateAt!
          ? "window"
          : "over"

  useEffect(() => {
    if (prevPhase.current === "wait" && phase === "window") {
      ping("Królówka", "Może już spaść. Okno: zbicie − 5 min, potem 40 min–2 h.")
      if (soundEnabled) {
        playTimerSound("baroness", volume / 100)
      }
    }
    if (prevPhase.current === "window" && phase === "over") {
      ping("Królówka", "Koniec okna — ktoś pewnie nie wpisał zbicia. Kliknij Zbiłem królówkę.")
    }
    prevPhase.current = phase
  }, [phase, soundEnabled, volume])

  let headline = "—"
  if (phase === "wait" && earlyAt) headline = formatRemain(earlyAt - now)
  if (phase === "window" && lateAt) headline = formatRemain(lateAt - now)
  if (phase === "over") headline = "—"

  const nextLabel =
    nextQueen.nicks.length === 0
      ? "—"
      : nextQueen.nicks.length === 1
        ? `${nextQueen.nicks[0]} (${nextQueen.queens})`
        : nextQueen.nicks.map((nick) => `${nick} (${nextQueen.queens})`).join(", ")

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Resp królówki</CardTitle>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground select-none">
            <span className="hidden sm:inline">Dźwięk</span>
            <Switch
              size="sm"
              checked={soundEnabled}
              onCheckedChange={onToggleSound}
              aria-label="Dźwięk powiadomienia dla resp królówki"
            />
          </label>
        </div>
        <CardDescription>
          Okno 40 min–2 h. Kliknięcie „Zbiłem królówkę” resetuje timer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="font-mono text-3xl tabular-nums">{headline}</p>
        <p className="text-sm">
          Następna osoba w kolejce: <span className="font-medium">{nextLabel}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Ostatnie zbicie{lastKill ? ` ${lastKill.label}` : " —"}
        </p>
      </CardContent>
    </Card>
  )
}

function SyncButton({
  pending,
  onSync,
  label = "Synchronizuj",
}: {
  pending: boolean
  onSync: (time: string) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState("")

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          askNotify()
          setTime(formatTimeWarsaw())
          setOpen(true)
        }}
      >
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Domyślnie godzina kliknięcia. Możesz wpisać inną, format HH:MM:SS.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sync-time">Czas</FieldLabel>
              <Input
                id="sync-time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                placeholder="HH:MM:SS"
                inputMode="numeric"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={() => {
                setOpen(false)
                onSync(time)
              }}
            >
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RunTimers({
  syncs,
  lastQueenKill,
  nextQueen,
}: {
  syncs: RunSyncState[]
  lastQueenKill: { at: string; label: string } | null
  nextQueen: {
    nicks: string[]
    queens: number
    party: { nick: string; queens: number }[]
  }
}) {
  const [pending, startTransition] = useTransition()
  const byKind = new Map(syncs.map((item) => [item.kind, item]))

  const [volume, setVolume] = useState(70)
  const [soundCocoons, setSoundCocoons] = useState(false)
  const [soundNets, setSoundNets] = useState(false)
  const [soundBaroness, setSoundBaroness] = useState(false)

  // Load preferences from localStorage after mount
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem("v3_sound_volume")
      if (savedVol !== null) {
        const num = Number(savedVol)
        if (!isNaN(num)) setVolume(num)
      }
      if (localStorage.getItem("v3_sound_cocoons") === "true") setSoundCocoons(true)
      if (localStorage.getItem("v3_sound_nets") === "true") setSoundNets(true)
      if (localStorage.getItem("v3_sound_baroness") === "true") setSoundBaroness(true)
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  function handleVolumeChange(val: number) {
    setVolume(val)
    try {
      localStorage.setItem("v3_sound_volume", String(val))
    } catch {
      // Ignore
    }
  }

  function handleToggleSound(type: TimerSoundType, checked: boolean) {
    if (type === "cocoons") {
      setSoundCocoons(checked)
      try {
        localStorage.setItem("v3_sound_cocoons", String(checked))
      } catch {}
    } else if (type === "nets") {
      setSoundNets(checked)
      try {
        localStorage.setItem("v3_sound_nets", String(checked))
      } catch {}
    } else if (type === "baroness") {
      setSoundBaroness(checked)
      try {
        localStorage.setItem("v3_sound_baroness", String(checked))
      } catch {}
    }

    if (checked) {
      askNotify()
      playTimerSound(type, volume / 100)
    }
  }

  function sync(kind: string, time: string) {
    startTransition(async () => {
      const result = await syncRunTimer(kind, time)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Zsynchronizowano")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Master Volume Slider */}
      <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-card p-3 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {volume === 0 ? (
              <VolumeX className="size-4 text-muted-foreground" />
            ) : volume < 50 ? (
              <Volume1 className="size-4 text-primary" />
            ) : (
              <Volume2 className="size-4 text-primary" />
            )}
            <span>Głośność powiadomień</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{volume}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary transition-all focus:outline-none"
          aria-label="Głośność powiadomień"
        />
      </div>

      <LoopTimer
        title="Następne kokony"
        description="1 h od synchronizacji, potem od nowa i ping."
        periodMs={COCOON_MS}
        sync={byKind.get("cocoons")}
        pingTitle="Kokony"
        pingBody="Są kokony. Timer poszedł od nowa."
        soundType="cocoons"
        soundEnabled={soundCocoons}
        onToggleSound={(checked) => handleToggleSound("cocoons", checked)}
        volume={volume}
        pending={pending}
        onSync={(time) => sync("cocoons", time)}
      />
      <LoopTimer
        title="Resp siatek"
        description="Dokładnie 3 minuty od synchronizacji, potem od nowa."
        periodMs={NETS_MS}
        sync={byKind.get("nets")}
        pingTitle="Siatki"
        pingBody="Resp siatek. Timer poszedł od nowa."
        soundType="nets"
        soundEnabled={soundNets}
        onToggleSound={(checked) => handleToggleSound("nets", checked)}
        volume={volume}
        pending={pending}
        onSync={(time) => sync("nets", time)}
      />
      <QueenTimer
        lastKill={lastQueenKill}
        nextQueen={nextQueen}
        soundEnabled={soundBaroness}
        onToggleSound={(checked) => handleToggleSound("baroness", checked)}
        volume={volume}
      />
    </div>
  )
}
