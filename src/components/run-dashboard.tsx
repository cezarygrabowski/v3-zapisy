"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { recordBaronKill, recordQueenKill, undoKill } from "@/lib/actions/run"
import type { KillLogItem, RunSyncState } from "@/lib/queries"
import { RunTimers } from "@/components/run-timers"
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
import { Spinner } from "@/components/ui/spinner"

type Person = {
  id: string
  gameNick: string
  positionLabel?: string
}

export function RunDashboard({
  currentUserId,
  isLeader,
  people,
  kills,
  syncs,
  queenCounts,
}: {
  currentUserId: string
  isLeader: boolean
  people: Person[]
  kills: KillLogItem[]
  syncs: RunSyncState[]
  queenCounts: { userId: string; queens: number }[]
}) {
  const [pending, startTransition] = useTransition()
  const [baronOpen, setBaronOpen] = useState(false)
  const [helpers, setHelpers] = useState<string[]>([])

  const others = people.filter((person) => person.id !== currentUserId)
  const lastQueen = kills.find((kill) => kill.kind === "queen")
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

  function run(action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Zapisano")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          className="h-16 w-full text-base"
          disabled={pending}
          onClick={() => run(() => recordQueenKill())}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Zbiłem królówkę
        </Button>
        <Button
          className="h-16 w-full text-base"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setHelpers([])
            setBaronOpen(true)
          }}
        >
          Zbiłem baronkę
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">Ostatnie zbicia</h2>
          {kills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Jeszcze nic dziś nie zbito — albo nikt nie kliknął.</p>
          ) : (
            <ol className="flex max-h-[min(22rem,50vh)] flex-col gap-1 overflow-y-auto pr-1">
              {kills.map((kill) => {
                const names =
                  kill.kind === "baron"
                    ? [kill.reporterNick, ...kill.helperNicks.filter((nick) => nick !== kill.reporterNick)].join(", ")
                    : kill.reporterNick
                const canUndo = isLeader || kill.reportedBy === currentUserId
                return (
                  <li
                    key={kill.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-sm tabular-nums">{kill.killedAtLabel}</span>
                      <Badge variant="secondary">
                        {kill.kind === "queen" ? "królówka" : "baronka"}
                      </Badge>
                      <span className="truncate text-sm">{names}</span>
                    </div>
                    {canUndo ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => undoKill(kill.id))}
                      >
                        Cofnij
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">Timery</h2>
          <RunTimers
            syncs={syncs}
            lastQueenKill={
              lastQueen
                ? { at: lastQueen.killedAt, label: lastQueen.killedAtLabel }
                : null
            }
            nextQueen={nextQueen}
          />
        </section>
      </div>

      <Dialog open={baronOpen} onOpenChange={setBaronOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Z kim biłeś baronkę?</DialogTitle>
            <DialogDescription>
              Ty jesteś już dopisany. Zaznacz resztę ekipy i zatwierdź — czas weźmie się z serwera.
            </DialogDescription>
          </DialogHeader>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nie ma kogo dodać z dzisiejszego slota. Zapisze się tylko Ty.
            </p>
          ) : (
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {others.map((person) => {
                const checked = helpers.includes(person.id)
                return (
                  <Field key={person.id} orientation="horizontal">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        setHelpers((current) =>
                          value === true
                            ? [...current, person.id]
                            : current.filter((id) => id !== person.id)
                        )
                      }}
                    />
                    <FieldLabel className="font-normal">
                      {person.gameNick}
                      {person.positionLabel ? (
                        <span className="text-muted-foreground"> · {person.positionLabel}</span>
                      ) : null}
                    </FieldLabel>
                  </Field>
                )
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaronOpen(false)}>
              Anuluj
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setBaronOpen(false)
                run(() => recordBaronKill(helpers))
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Zapisz baronkę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
