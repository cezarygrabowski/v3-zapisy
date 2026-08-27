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
      toast.success(result.message ?? "Zgłoszono wpłatę.")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>Zaległe składki (zamknięte tygodnie)</CardDescription>
          <CardTitle className="font-heading text-3xl">
            {state.overdueKk > 0 ? `${state.overdueKk} kk` : "Nic nie zalegasz"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pending ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              Zgłoszono {pending.amountKk} kk {formatRelativePl(pending.createdAt)}. Czeka na admina.
            </p>
          ) : offers.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Nie liczymy aktualnego tygodnia.</p>
              <div className="flex flex-wrap gap-2">
                {offers.map((item) => (
                  <Button
                    key={item.amountKk}
                    variant={item.label.startsWith("Całość") ? "default" : "outline"}
                    disabled={waiting}
                    onClick={() => setOffer(item)}
                  >
                    {waiting ? <Spinner data-icon="inline-start" /> : null}
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(offer)} onOpenChange={(open) => !open && setOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zgłosić {offer?.label}?</AlertDialogTitle>
            <AlertDialogDescription>{offer?.detail}. Admin potwierdzi, jak zbierze yang.</AlertDialogDescription>
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
              Zgłoś
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {state.overdueWeeks.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">Poprzednie tygodnie</h2>
          {state.overdueWeeks.map((week) => (
            <WeekRow
              key={week.weekStart}
              label={week.label}
              remainingKk={week.remainingKk}
              entries={week.entries}
            />
          ))}
        </section>
      ) : null}

      {state.currentWeek ? (
        <p className="text-sm text-muted-foreground">
          Ten tydzień (trwa): {state.currentWeekRemainingKk} kk · {state.currentWeek.entries.length}{" "}
          {entryWord(state.currentWeek.entries.length)}
        </p>
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


