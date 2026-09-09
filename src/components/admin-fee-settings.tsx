"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setFeeSettlementDays } from "@/lib/actions/admin"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

function getExplanation(days: number): string {
  if (days === 0) {
    return "Blokada zapisów wchodzi natychmiast w poniedziałek o 00:00 dla każdego z zaległością z poprzedniego tygodnia."
  }
  if (days === 1) {
    return "Gracze mają 1 dzień (poniedziałek) na uregulowanie składki. Blokada zapisów na V3 wchodzi we wtorek od 00:00."
  }
  if (days === 2) {
    return "Gracze mają 2 dni (poniedziałek i wtorek) na uregulowanie składki. Blokada zapisów na V3 wchodzi w środę od 00:00."
  }
  if (days === 3) {
    return "Gracze mają 3 dni (poniedziałek, wtorek i środę) na uregulowanie składki. Blokada zapisów na V3 wchodzi w czwartek od 00:00."
  }
  if (days === 4) {
    return "Gracze mają 4 dni (poniedziałek–czwartek) na uregulowanie składki. Blokada zapisów na V3 wchodzi w piątek od 00:00."
  }
  if (days === 7) {
    return "Gracze mają pełny tydzień (7 dni, poniedziałek–niedziela) na uregulowanie składki."
  }
  return `Gracze mają ${days} dni od poniedziałku na opłacenie składki, po czym zapisy na V3 są blokowane.`
}

export function AdminFeeSettings({ initialDays }: { initialDays: number }) {
  const [days, setDays] = useState(initialDays)
  const [pending, startTransition] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await setFeeSettlementDays(days)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? "Zapisano ustawienia.")
    })
  }

  const isChanged = days !== initialDays

  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <div>
            <CardTitle className="text-base font-semibold">
              Regulamin składek: Czas na spłatę za poprzedni tydzień
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Określ, ile dni od rozpoczęcia nowego tygodnia (od poniedziałku) użytkownicy mają na uregulowanie
              składki za miniony tydzień, zanim możliwość zapisu na nowe wydarzenia V3 zostanie zablokowana.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="settlement-days-input" className="text-sm font-medium whitespace-nowrap">
                Liczba dni karencji:
              </label>
              <Input
                id="settlement-days-input"
                type="number"
                min={0}
                max={14}
                value={days}
                onChange={(e) => setDays(Math.max(0, Math.min(14, parseInt(e.target.value, 10) || 0)))}
                className="w-20 text-center font-mono font-bold text-sm h-9"
              />
              <span className="text-sm text-muted-foreground">dni</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Szybki wybór:</span>
              {[1, 2, 3, 4, 7].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="xs"
                  variant={days === preset ? "secondary" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setDays(preset)}
                >
                  {preset} {preset === 1 ? "dzień" : preset < 5 ? "dni" : "dni"}
                  {preset === 2 ? " (rekom.)" : ""}
                </Button>
              ))}
            </div>
          </div>

          {/* Explanation banner */}
          <div className="rounded-lg bg-muted/50 border p-3 text-xs flex items-start gap-2.5">
            <span className="text-base shrink-0">ℹ️</span>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-foreground">
                Działanie wybranego limitu ({days} {days === 1 ? "dzień" : "dni"}):
              </span>
              <span className="text-muted-foreground leading-relaxed">
                {getExplanation(days)}
              </span>
              <span className="text-[11px] text-muted-foreground opacity-80 mt-0.5">
                Liderzy zachowują uprawnienia do ręcznego dopisania gracza opcją <code>+ Wpisz</code> nawet jeśli gracz posiada zaległość.
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={pending || !isChanged}
              className="gap-2 px-5 font-semibold text-xs"
            >
              {pending ? <Spinner className="h-4 w-4" /> : null}
              {isChanged ? "Zapisz ustawienie" : "Aktualne"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
