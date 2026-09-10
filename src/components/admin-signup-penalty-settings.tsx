"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setPenaltyRules, setSignupAdvanceSettings } from "@/lib/actions/admin"
import { DEFAULT_PENALTY_RULES, type PenaltyRulesConfig } from "@/lib/settings-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, ShieldAlertIcon, RotateCcwIcon, CheckIcon, ClockIcon } from "lucide-react"

export function AdminSignupPenaltySettings({
  initialAdvanceDays,
  initialOpenTime = "09:00",
  initialPenaltyRules,
}: {
  initialAdvanceDays: number
  initialOpenTime?: string
  initialPenaltyRules: PenaltyRulesConfig
}) {
  // Signup advance state
  const [advanceDays, setAdvanceDays] = useState(initialAdvanceDays)
  const [openTime, setOpenTime] = useState(initialOpenTime)
  const [pendingAdvance, startAdvanceTransition] = useTransition()

  // Penalty rules state
  const [penaltyRules, setPenaltyRulesState] = useState<PenaltyRulesConfig>(initialPenaltyRules)
  const [pendingRules, startRulesTransition] = useTransition()

  const isAdvanceChanged = advanceDays !== initialAdvanceDays || openTime !== initialOpenTime
  const isRulesChanged =
    penaltyRules.card1.durationDays !== initialPenaltyRules.card1.durationDays ||
    penaltyRules.card1.advanceDays !== initialPenaltyRules.card1.advanceDays ||
    penaltyRules.card2.durationDays !== initialPenaltyRules.card2.durationDays ||
    penaltyRules.card2.advanceDays !== initialPenaltyRules.card2.advanceDays ||
    penaltyRules.card3.durationDays !== initialPenaltyRules.card3.durationDays ||
    penaltyRules.card3.advanceDays !== initialPenaltyRules.card3.advanceDays

  function handleSaveAdvance(e: React.FormEvent) {
    e.preventDefault()
    startAdvanceTransition(async () => {
      const res = await setSignupAdvanceSettings({ advanceDays, openTime })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? "Zapisano wyprzedzenie zapisów.")
    })
  }

  function handleSaveRules(e: React.FormEvent) {
    e.preventDefault()
    startRulesTransition(async () => {
      const res = await setPenaltyRules(penaltyRules)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message ?? "Zapisano reguły kar.")
    })
  }

  function handleResetRulesToDefault() {
    setPenaltyRulesState(DEFAULT_PENALTY_RULES)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Signup Advance Settings */}
      <Card className="border shadow-xs flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📅</span>
              <div>
                <CardTitle className="text-base font-semibold">
                  Wyprzedzenie zapisów na wydarzenia
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Określ, z ilodniowym wyprzedzeniem gracze (bez nałożonych kar) mogą zapisywać się na wydarzenia V3 i rajdy.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <form onSubmit={handleSaveAdvance} className="flex flex-col gap-4">
              {/* Advance days input */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="advance-days-input" className="text-sm font-medium whitespace-nowrap">
                    Wyprzedzenie:
                  </label>
                  <Input
                    id="advance-days-input"
                    type="number"
                    min={0}
                    max={30}
                    value={advanceDays}
                    onChange={(e) =>
                      setAdvanceDays(Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)))
                    }
                    className="w-20 text-center font-mono font-bold text-sm h-9"
                  />
                  <span className="text-sm text-muted-foreground">
                    {advanceDays === 1 ? "dzień" : "dni"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Szybki wybór:</span>
                  {[1, 2, 3, 4, 7].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="xs"
                      variant={advanceDays === preset ? "secondary" : "outline"}
                      className="h-7 text-xs px-2.5"
                      onClick={() => setAdvanceDays(preset)}
                    >
                      {preset} {preset === 1 ? "dzień" : preset < 5 ? "dni" : "dni"}
                      {preset === 2 ? " (rekom.)" : ""}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Opening hour input */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <label htmlFor="open-time-input" className="text-sm font-medium whitespace-nowrap flex items-center gap-1.5">
                    <ClockIcon className="size-3.5 text-muted-foreground" />
                    Godzina otwarcia:
                  </label>
                  <Input
                    id="open-time-input"
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="w-24 text-center font-mono font-bold text-sm h-9"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">Szybki wybór:</span>
                  {["00:00", "08:00", "09:00", "12:00", "18:00", "20:00"].map((timePreset) => (
                    <Button
                      key={timePreset}
                      type="button"
                      size="xs"
                      variant={openTime === timePreset ? "secondary" : "outline"}
                      className="h-7 text-xs px-2 font-mono"
                      onClick={() => setOpenTime(timePreset)}
                    >
                      {timePreset}
                      {timePreset === "09:00" ? " (rekom.)" : ""}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Dynamic explanation callout */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground flex flex-col gap-1">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 text-primary shrink-0" />
                  Zasada działania:
                </span>
                <p className="leading-relaxed">
                  {advanceDays === 0 ? (
                    <>
                      Zapisy są możliwe wyłącznie w dniu trwania danego wydarzenia od godziny <strong>{openTime}</strong>.
                    </>
                  ) : (
                    <>
                      Gracze mogą zapisywać się na wydarzenia do <strong>{advanceDays} {advanceDays === 1 ? "dnia" : "dni"} w przód</strong>.
                      Nowe zapisy na dany dzień odblokowują się automatycznie codziennie o <strong>{openTime}</strong> czasu polskiego na {advanceDays} {advanceDays === 1 ? "dzień" : "dni"} przed wydarzeniem (np. zapisy na sobotę ruszają w czwartek o {openTime} przy 2 dniach wyprzedzenia).
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {isAdvanceChanged && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setAdvanceDays(initialAdvanceDays)
                      setOpenTime(initialOpenTime)
                    }}
                  >
                    Anuluj
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={pendingAdvance || !isAdvanceChanged}
                  className="text-xs h-8 gap-1.5"
                >
                  {pendingAdvance ? <Spinner className="size-3.5" /> : <CheckIcon className="size-3.5" />}
                  Zapisz wyprzedzenie
                </Button>
              </div>
            </form>
          </CardContent>
        </div>
      </Card>

      {/* 2. Yellow Card Penalty Rules */}
      <Card className="border shadow-xs flex flex-col justify-between">
        <div>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🟨</span>
              <div>
                <CardTitle className="text-base font-semibold">
                  Reguły kar za żółte kartki
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Skonfiguruj, ile dni trwa kara i z jakim wyprzedzeniem może zapisywać się gracz po otrzymaniu danej żółtej kartki.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <form onSubmit={handleSaveRules} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {/* Level 1 */}
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 text-xs font-bold shrink-0">
                      1. kartka
                    </Badge>
                    <span className="text-xs text-muted-foreground">Pierwsze wykroczenie</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Kara:</span>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={penaltyRules.card1.durationDays}
                        onChange={(e) =>
                          setPenaltyRulesState((prev) => ({
                            ...prev,
                            card1: {
                              ...prev.card1,
                              durationDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                            },
                          }))
                        }
                        className="w-16 text-center font-mono font-bold text-xs h-8"
                      />
                      <span className="text-xs text-muted-foreground">dni</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Zapisy:</span>
                      <Input
                        type="number"
                        min={0}
                        max={14}
                        value={penaltyRules.card1.advanceDays}
                        onChange={(e) =>
                          setPenaltyRulesState((prev) => ({
                            ...prev,
                            card1: {
                              ...prev.card1,
                              advanceDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                            },
                          }))
                        }
                        className="w-16 text-center font-mono font-bold text-xs h-8"
                      />
                      <span className="text-xs text-muted-foreground">
                        {penaltyRules.card1.advanceDays === 1 ? "dzień" : "dni"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Level 2 */}
                <div className="p-3 rounded-lg border border-amber-600/30 bg-amber-600/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-600/25 text-amber-900 dark:text-amber-200 border-amber-600/40 text-xs font-bold shrink-0">
                      2. kartka
                    </Badge>
                    <span className="text-xs text-muted-foreground">Drugie wykroczenie</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Kara:</span>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={penaltyRules.card2.durationDays}
                        onChange={(e) =>
                          setPenaltyRulesState((prev) => ({
                            ...prev,
                            card2: {
                              ...prev.card2,
                              durationDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                            },
                          }))
                        }
                        className="w-16 text-center font-mono font-bold text-xs h-8"
                      />
                      <span className="text-xs text-muted-foreground">dni</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Zapisy:</span>
                      <Input
                        type="number"
                        min={0}
                        max={14}
                        value={penaltyRules.card2.advanceDays}
                        onChange={(e) =>
                          setPenaltyRulesState((prev) => ({
                            ...prev,
                            card2: {
                              ...prev.card2,
                              advanceDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                            },
                          }))
                        }
                        className="w-16 text-center font-mono font-bold text-xs h-8"
                      />
                      <span className="text-xs text-muted-foreground">
                        {penaltyRules.card2.advanceDays === 1 ? "dzień" : "dni"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Level 3 */}
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40 text-xs font-bold shrink-0">
                      3. kartka +
                    </Badge>
                    <span className="text-xs text-muted-foreground">Recydywa (3 i kolejne)</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Kara:</span>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={penaltyRules.card3.durationDays}
                        onChange={(e) =>
                          setPenaltyRulesState((prev) => ({
                            ...prev,
                            card3: {
                              ...prev.card3,
                              durationDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                            },
                          }))
                        }
                        className="w-16 text-center font-mono font-bold text-xs h-8"
                      />
                      <span className="text-xs text-muted-foreground">dni</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Zapisy:</span>
                      <Input
                        type="number"
                        min={0}
                        max={14}
                        value={penaltyRules.card3.advanceDays}
                        onChange={(e) =>
                          setPenaltyRulesState((prev) => ({
                            ...prev,
                            card3: {
                              ...prev.card3,
                              advanceDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                            },
                          }))
                        }
                        className="w-16 text-center font-mono font-bold text-xs h-8"
                      />
                      <span className="text-xs text-muted-foreground">
                        {penaltyRules.card3.advanceDays === 1 ? "dzień" : "dni"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic summary callout */}
              <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex flex-col gap-1.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlertIcon className="size-3.5 text-amber-500 shrink-0" />
                  Podsumowanie konsekwencji:
                </span>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                  <li>
                    <strong>1. kartka</strong>: ograniczenie do {penaltyRules.card1.advanceDays} {penaltyRules.card1.advanceDays === 1 ? "dnia" : "dni"} w przód przez <strong>{penaltyRules.card1.durationDays} dni</strong>.
                  </li>
                  <li>
                    <strong>2. kartka</strong>: ograniczenie do {penaltyRules.card2.advanceDays} {penaltyRules.card2.advanceDays === 1 ? "dnia" : "dni"} w przód przez <strong>{penaltyRules.card2.durationDays} dni</strong>.
                  </li>
                  <li>
                    <strong>3. kartka i kolejne</strong>: ograniczenie do {penaltyRules.card3.advanceDays} {penaltyRules.card3.advanceDays === 1 ? "dnia" : "dni"} w przód przez <strong>{penaltyRules.card3.durationDays} dni</strong>.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={handleResetRulesToDefault}
                  title="Przywróć standardowe wartości: 3d/7d/14d i 1 dzień w przód"
                >
                  <RotateCcwIcon className="size-3" />
                  Domyślne
                </Button>

                <div className="flex items-center gap-2">
                  {isRulesChanged && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setPenaltyRulesState(initialPenaltyRules)}
                    >
                      Anuluj
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={pendingRules || !isRulesChanged}
                    className="text-xs h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {pendingRules ? <Spinner className="size-3.5" /> : <CheckIcon className="size-3.5" />}
                    Zapisz reguły kar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </div>
      </Card>
    </div>
  )
}
