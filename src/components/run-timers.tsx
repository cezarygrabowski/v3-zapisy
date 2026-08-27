"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { syncRunTimer } from "@/lib/actions/run"
import { formatTimeWarsaw } from "@/lib/dates"
import type { RunSyncState } from "@/lib/queries"
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
  onSync,
  pending,
}: {
  title: string
  description: string
  periodMs: number
  sync: RunSyncState | undefined
  pingTitle: string
  pingBody: string
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
    }
    prevCycle.current = cycle
  }, [cycle, pingBody, pingTitle])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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
}: {
  lastKill: { at: string; label: string } | null
  nextQueen: {
    nicks: string[]
    queens: number
    party: { nick: string; queens: number }[]
  }
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
    }
    if (prevPhase.current === "window" && phase === "over") {
      ping("Królówka", "Koniec okna — ktoś pewnie nie wpisał zbicia. Kliknij Zbiłem królówkę.")
    }
    prevPhase.current = phase
  }, [phase])

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
      <CardHeader>
        <CardTitle>Resp królówki</CardTitle>
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
      <LoopTimer
        title="Następne kokony"
        description="1 h od synchronizacji, potem od nowa i ping."
        periodMs={COCOON_MS}
        sync={byKind.get("cocoons")}
        pingTitle="Kokony"
        pingBody="Są kokony. Timer poszedł od nowa."
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
        pending={pending}
        onSync={(time) => sync("nets", time)}
      />
      <QueenTimer lastKill={lastQueenKill} nextQueen={nextQueen} />
    </div>
  )
}
