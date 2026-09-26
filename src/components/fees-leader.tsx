"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { confirmPayment, recordPayment, rejectPayment, seedDemoFeeHistory } from "@/lib/actions/fees"
import { playstyleLabel, type Playstyle } from "@/lib/constants"
import { formatRelativePl } from "@/lib/dates"
import { paymentOffers, type UserFeeState } from "@/lib/fees"
import type { FeePaymentHistoryItem, PendingFeePayment } from "@/lib/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeesOfferList } from "@/components/fees-offer-list"
import { entryWord, WeekEntries } from "@/components/fees-week-entries"

export function FeesLeader({
  pending,
  states,
  history,
  canSeed = false,
}: {
  pending: PendingFeePayment[]
  states: UserFeeState[]
  history: FeePaymentHistoryItem[]
  canSeed?: boolean
}) {
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [collect, setCollect] = useState<UserFeeState | null>(null)
  const [waiting, startTransition] = useTransition()

  // Previous week calculations
  const previousOwing = useMemo(() => {
    return states
      .filter((row) => row.previousWeek.remainingKk > 0)
      .sort(
        (a, b) =>
          b.previousWeek.remainingKk - a.previousWeek.remainingKk ||
          a.gameNick.localeCompare(b.gameNick, "pl")
      )
  }, [states])

  const previousClear = useMemo(() => {
    return states
      .filter(
        (row) =>
          row.previousWeek.chargedKk > 0 && row.previousWeek.remainingKk === 0
      )
      .sort((a, b) => a.gameNick.localeCompare(b.gameNick, "pl"))
  }, [states])

  const previousTotalKk = previousOwing.reduce(
    (sum, row) => sum + row.previousWeek.remainingKk,
    0
  )

  const previousWeekLabel =
    states.find((row) => row.previousWeek?.label)?.previousWeek.label ?? "Poprzedni tydzień"

  // All-time (to date, including current week) calculations
  const allOwing = useMemo(() => {
    return states
      .filter((row) => row.toDateKk > 0)
      .sort(
        (a, b) =>
          b.toDateKk - a.toDateKk ||
          a.gameNick.localeCompare(b.gameNick, "pl")
      )
  }, [states])

  const allClear = useMemo(() => {
    return states
      .filter((row) => row.toDateKk === 0)
      .sort((a, b) => a.gameNick.localeCompare(b.gameNick, "pl"))
  }, [states])

  const allTotalKk = allOwing.reduce((sum, row) => sum + row.toDateKk, 0)

  // Search filter
  const needle = query.trim().toLocaleLowerCase("pl")

  const filteredPrevious = useMemo(() => {
    if (!needle) return previousOwing
    return previousOwing.filter((row) =>
      row.gameNick.toLocaleLowerCase("pl").includes(needle)
    )
  }, [previousOwing, needle])

  const filteredAll = useMemo(() => {
    if (!needle) return allOwing
    return allOwing.filter((row) =>
      row.gameNick.toLocaleLowerCase("pl").includes(needle)
    )
  }, [allOwing, needle])

  function run(action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Zapisano.")
    })
  }

  const collectOffers = collect ? paymentOffers(collect) : []

  return (
    <div className="flex flex-col gap-8">
      {canSeed ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={waiting}
          onClick={() => run(() => seedDemoFeeHistory())}
        >
          {waiting ? <Spinner data-icon="inline-start" /> : null}
          Wgraj 2 tygodnie demo
        </Button>
      ) : null}

      {pending.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">Do potwierdzenia</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((item) => (
              <Card key={item.id} size="sm">
                <CardHeader>
                  <CardTitle>{item.gameNick}</CardTitle>
                  <CardDescription>
                    {item.amountKk} kk · zgłosił: zapłacił {formatRelativePl(item.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button
                    disabled={waiting}
                    onClick={() => run(() => confirmPayment(item.id))}
                  >
                    {waiting ? <Spinner data-icon="inline-start" /> : null}
                    Potwierdź wpłatę
                  </Button>
                  <Button
                    variant="outline"
                    disabled={waiting}
                    onClick={() => run(() => rejectPayment(item.id))}
                  >
                    Odrzuć
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <Tabs defaultValue="previous" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="previous">Poprzedni tydzień</TabsTrigger>
          <TabsTrigger value="all">Do tej pory</TabsTrigger>
        </TabsList>

        <TabsContent value="previous" className="flex flex-col gap-6 pt-2">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold">Do zebrania za poprzedni tydzień</h2>
                <p className="text-sm text-muted-foreground">
                  {previousOwing.length} {personWord(previousOwing.length)} · {previousTotalKk} kk ({previousWeekLabel})
                </p>
              </div>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Szukaj nicku"
                className="sm:max-w-56"
                aria-label="Szukaj nicku"
              />
            </div>

            {filteredPrevious.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {previousOwing.length === 0
                  ? "Nikt nie zalega za poprzedni tydzień."
                  : "Brak nicku na liście."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gracz</TableHead>
                    <TableHead>Do zapłaty</TableHead>
                    <TableHead>Wejścia</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrevious.map((row) => (
                    <Fragment key={row.userId}>
                      <TableRow>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="font-medium underline-offset-2 hover:underline"
                              onClick={() =>
                                setOpenId((current) => (current === row.userId ? null : row.userId))
                              }
                            >
                              {row.gameNick}
                            </button>
                            {row.playstyle ? (
                              <Badge variant="secondary">{playstyleLabel(row.playstyle as Playstyle)}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{row.previousWeek.remainingKk} kk</TableCell>
                        <TableCell>
                          {row.previousWeek.entries.length} {entryWord(row.previousWeek.entries.length)} · {row.previousWeek.chargedKk} kk
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" disabled={waiting} onClick={() => setCollect(row)}>
                            Zapłacił
                          </Button>
                        </TableCell>
                      </TableRow>
                      {openId === row.userId ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <div className="flex flex-col gap-2 py-1">
                              <p className="text-sm font-medium">
                                {row.previousWeek.label} · {row.previousWeek.remainingKk} kk do zapłaty ({row.previousWeek.chargedKk} kk naliczone)
                              </p>
                              <WeekEntries entries={row.previousWeek.entries} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {previousClear.length > 0 ? (
            <details className="rounded-xl bg-card ring-1 ring-foreground/10">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Rozliczeni za poprzedni tydzień ({previousClear.length})
              </summary>
              <ul className="flex flex-col gap-1 px-4 pb-4 text-sm text-muted-foreground">
                {previousClear.map((row) => (
                  <li key={row.userId}>
                    {row.gameNick} · {row.previousWeek.chargedKk} kk (opłacone)
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </TabsContent>

        <TabsContent value="all" className="flex flex-col gap-6 pt-2">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold">Do zebrania do tej pory</h2>
                <p className="text-sm text-muted-foreground">
                  {allOwing.length} {personWord(allOwing.length)} · {allTotalKk} kk (z aktualnym tygodniem)
                </p>
              </div>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Szukaj nicku"
                className="sm:max-w-56"
                aria-label="Szukaj nicku"
              />
            </div>

            {filteredAll.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {allOwing.length === 0 ? "Nikt nie zalega." : "Brak nicku na liście."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gracz</TableHead>
                    <TableHead>Do tej pory</TableHead>
                    <TableHead>Tygodnie</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAll.map((row) => (
                    <Fragment key={row.userId}>
                      <TableRow>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="font-medium underline-offset-2 hover:underline"
                              onClick={() =>
                                setOpenId((current) => (current === row.userId ? null : row.userId))
                              }
                            >
                              {row.gameNick}
                            </button>
                            {row.playstyle ? (
                              <Badge variant="secondary">{playstyleLabel(row.playstyle as Playstyle)}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{row.toDateKk} kk</TableCell>
                        <TableCell>{row.toDateWeeks.length}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" disabled={waiting} onClick={() => setCollect(row)}>
                            Zapłacił
                          </Button>
                        </TableCell>
                      </TableRow>
                      {openId === row.userId ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <div className="flex flex-col gap-3 py-1">
                              {row.toDateWeeks.map((week) => (
                                <div key={week.weekStart} className="flex flex-col gap-1">
                                  <p className="text-sm font-medium">
                                    {week.closed ? week.label : `${week.label} (ten tydzień)`} · {week.remainingKk} kk · {week.entries.length}{" "}
                                    {entryWord(week.entries.length)}
                                  </p>
                                  <WeekEntries entries={week.entries} />
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {allClear.length > 0 ? (
            <details className="rounded-xl bg-card ring-1 ring-foreground/10">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Na zero do tej pory ({allClear.length})
              </summary>
              <ul className="flex flex-col gap-1 px-4 pb-4 text-sm text-muted-foreground">
                {allClear
                  .slice()
                  .sort((a, b) => a.gameNick.localeCompare(b.gameNick, "pl"))
                  .map((row) => (
                    <li key={row.userId}>
                      {row.gameNick}
                    </li>
                  ))}
              </ul>
            </details>
          ) : null}

          {history.length > 0 ? (
            <details className="rounded-xl bg-card ring-1 ring-foreground/10">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Ostatnie wpłaty ({history.length})
              </summary>
              <div className="px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gracz</TableHead>
                      <TableHead>Kwota</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Kto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.gameNick}</TableCell>
                        <TableCell>{item.amountKk} kk</TableCell>
                        <TableCell>
                          {item.status === "confirmed" ? "potwierdzona" : "odrzucona"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.confirmedByNick ?? item.reportedByNick}
                          {item.resolvedAt ? ` · ${formatRelativePl(item.resolvedAt)}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          ) : null}
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(collect)} onOpenChange={(open) => !open && setCollect(null)}>
        <AlertDialogContent className="max-w-md data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {collect ? `Wpłata: ${collect.gameNick}` : "Wpłata"}
            </AlertDialogTitle>
            <AlertDialogDescription>Wybierz kwotę wpłaconą przez gracza (zamknięte tygodnie):</AlertDialogDescription>
          </AlertDialogHeader>
          <FeesOfferList
            offers={collectOffers}
            disabled={waiting}
            onPick={(offer) => {
              if (!collect) return
              const userId = collect.userId
              setCollect(null)
              run(() => recordPayment(userId, offer.amountKk))
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function personWord(count: number): string {
  if (count === 1) return "osoba"
  if (count >= 2 && count <= 4) return "osoby"
  return "osób"
}
