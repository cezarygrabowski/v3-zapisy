"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { reportPayment } from "@/lib/actions/fees"
import { formatRelativePl } from "@/lib/dates"
import { paymentOffers, type PaymentOffer, type UserFeeState } from "@/lib/fees"
import type { PendingFeePayment } from "@/lib/queries"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { entryWord, WeekEntries } from "@/components/fees-week-entries"

export function FeesPlayer({
  state,
  pending,
}: {
  state: UserFeeState
  pending: PendingFeePayment | null
}) {
  const [waiting, startTransition] = useTransition()
  const [offer, setOffer] = useState<PaymentOffer | null>(null)
  const offers = paymentOffers(state)

  function report(amountKk: number) {
    startTransition(async () => {
      const result = await reportPayment(amountKk)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Zgłoszono: zapłacono.")
    })
  }

  const prevWeek = state.previousWeek
  const prevOwed = prevWeek.remainingKk
  const prevCharged = prevWeek.chargedKk

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="previous" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="previous">Poprzedni tydzień</TabsTrigger>
          <TabsTrigger value="all">Do tej pory</TabsTrigger>
        </TabsList>

        <TabsContent value="previous" className="flex flex-col gap-6 pt-2">
          <Card>
            <CardHeader>
              <CardDescription>Poprzedni tydzień ({prevWeek.label})</CardDescription>
              <CardTitle className="font-heading text-3xl">
                {prevOwed > 0
                  ? `${prevOwed} kk`
                  : prevCharged > 0
                    ? "Opłacone"
                    : "Brak wejść"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {pending ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                  Zgłoszono wpłatę {pending.amountKk} kk {formatRelativePl(pending.createdAt)}. Czeka na potwierdzenie przez admina.
                </p>
              ) : prevOwed > 0 ? (
                <div className="flex flex-col gap-2">
                  {offers.length === 1 ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={waiting}
                        onClick={() => setOffer(offers[0])}
                      >
                        {waiting ? <Spinner data-icon="inline-start" /> : null}
                        {offers[0].playerLabel ?? offers[0].label}
                      </Button>
                    </div>
                  ) : offers.length > 1 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-muted-foreground">
                        Posiadasz także wcześniejsze zaległości. Wybierz opcję spłaty:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {offers.map((item, index) => {
                          const isPrimary = index === offers.length - 1
                          return (
                            <Button
                              key={item.amountKk}
                              variant={isPrimary ? "default" : "outline"}
                              disabled={waiting}
                              onClick={() => setOffer(item)}
                            >
                              {waiting ? <Spinner data-icon="inline-start" /> : null}
                              {item.playerLabel ?? item.label}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : prevCharged > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Wszystkie składki za poprzedni tydzień ({prevCharged} kk) zostały rozliczone.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nie brałeś udziału w żadnych wypadach w poprzednim tygodniu.
                </p>
              )}
            </CardContent>
          </Card>

          {prevWeek.entries.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-heading text-lg font-semibold">
                Twoje wejścia ({prevWeek.entries.length} {entryWord(prevWeek.entries.length)} · {prevCharged} kk)
              </h2>
              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <WeekEntries entries={prevWeek.entries} />
              </div>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="all" className="flex flex-col gap-6 pt-2">
          <Card>
            <CardHeader>
              <CardDescription>Składki do tej pory (z bieżącym tygodniem)</CardDescription>
              <CardTitle className="font-heading text-3xl">
                {state.toDateKk > 0 ? `${state.toDateKk} kk` : "Nic nie zalegasz"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {pending ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                  Zgłoszono wpłatę {pending.amountKk} kk {formatRelativePl(pending.createdAt)}. Czeka na potwierdzenie przez admina.
                </p>
              ) : offers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">Wybierz kwotę do opłacenia:</p>
                  <div className="flex flex-wrap gap-2">
                    {offers.map((item, index) => {
                      const isPrimary = index === offers.length - 1
                      return (
                        <Button
                          key={item.amountKk}
                          variant={isPrimary ? "default" : "outline"}
                          disabled={waiting}
                          onClick={() => setOffer(item)}
                        >
                          {waiting ? <Spinner data-icon="inline-start" /> : null}
                          {item.playerLabel ?? item.label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {state.toDateWeeks.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-heading text-lg font-semibold">Tygodnie do rozliczenia</h2>
              {state.toDateWeeks.map((week) => (
                <WeekRow
                  key={week.weekStart}
                  label={week.closed ? week.label : `${week.label} (ten tydzień)`}
                  remainingKk={week.remainingKk}
                  entries={week.entries}
                />
              ))}
            </section>
          ) : null}

          {state.settledWeeks.length > 0 ? (
            <details className="rounded-xl bg-card ring-1 ring-foreground/10">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Opłacone tygodnie ({state.settledWeeks.length})
              </summary>
              <div className="flex flex-col gap-2 px-4 pb-4">
                {state.settledWeeks.map((week) => (
                  <p key={week.weekStart} className="text-sm text-muted-foreground">
                    {week.label} · {week.chargedKk} kk
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(offer)} onOpenChange={(open) => !open && setOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdzenie wpłaty</AlertDialogTitle>
            <AlertDialogDescription>
              Zgłaszasz: {offer?.playerLabel ?? offer?.label} ({offer?.detail}). Admin zweryfikuje i potwierdzi wpłatę w grze.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!offer) return
                const amountKk = offer.amountKk
                setOffer(null)
                report(amountKk)
              }}
            >
              Zapłaciłem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function WeekRow({
  label,
  remainingKk,
  entries,
}: {
  label: string
  remainingKk: number
  entries: UserFeeState["overdueWeeks"][number]["entries"]
}) {
  return (
    <details className="rounded-xl bg-card ring-1 ring-foreground/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{label}</span>
        <span>
          {entries.length} {entryWord(entries.length)} · {remainingKk} kk
        </span>
      </summary>
      <div className="px-4 pb-3">
        <WeekEntries entries={entries} />
      </div>
    </details>
  )
}


