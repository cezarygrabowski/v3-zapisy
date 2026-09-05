"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { recordCustomTimerKill } from "@/lib/actions/timers"
import { formatDuration } from "@/lib/red-las"
import type { CustomTimerWithChannels, TimerCategoryData } from "@/lib/timers-queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function PanelTimerCard({
  timer,
  mapName,
  mapIcon,
  now,
  onKillRecorded,
}: {
  timer: CustomTimerWithChannels
  mapName?: string
  mapIcon?: string
  now?: number
  onKillRecorded?: () => void
}) {
  const [pending, startTransition] = useTransition()

  function handleKill(channel: number) {
    startTransition(async () => {
      const res = await recordCustomTimerKill({
        timerId: timer.id,
        channel,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      onKillRecorded?.()
    })
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              {mapIcon ? <span className="text-base">{mapIcon}</span> : null}
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>{timer.name}</span>
                {mapName ? (
                  <span className="text-xs font-normal text-muted-foreground">({mapName})</span>
                ) : null}
              </CardTitle>
            </div>
            {timer.notes ? (
              <CardDescription className="text-xs mt-0.5">{timer.notes}</CardDescription>
            ) : null}
          </div>

          <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
            {timer.respawnMinMinutes === timer.respawnMaxMinutes
              ? `${timer.respawnMinMinutes}m`
              : `${timer.respawnMinMinutes}–${timer.respawnMaxMinutes}m`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-3 pb-3">
        {/* Channels Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {timer.channels.map((ch) => {
            const currentNow = now || 0
            let status = ch.status
            let remainingToWindowSeconds = ch.remainingToWindowSeconds
            let remainingInWindowSeconds = ch.remainingInWindowSeconds
            let overdueSeconds = ch.overdueSeconds

            // Only recompute on client (now > 0); during SSR use server values
            if (currentNow > 0 && ch.windowStartAt && ch.windowEndAt) {
              const startMs = new Date(ch.windowStartAt).getTime()
              const endMs = new Date(ch.windowEndAt).getTime()

              if (currentNow < startMs) {
                status = "counting"
                remainingToWindowSeconds = Math.max(0, Math.round((startMs - currentNow) / 1000))
              } else if (currentNow <= endMs) {
                status = "window"
                remainingInWindowSeconds = Math.max(0, Math.round((endMs - currentNow) / 1000))
              } else {
                status = "overdue"
                overdueSeconds = Math.max(0, Math.round((currentNow - endMs) / 1000))
              }
            }

            let cardBg = "bg-card border-border/70"
            let badgeEl = <Badge variant="outline" className="text-[10px] text-muted-foreground px-1 py-0">—</Badge>

            if (status === "counting") {
              cardBg = "bg-card border-blue-500/30"
              badgeEl = <Badge variant="outline" className="text-blue-500 border-blue-500/40 text-[9px] px-1 py-0">Odliczanie</Badge>
            } else if (status === "window") {
              cardBg = "bg-amber-950/20 border-amber-500/60 dark:bg-amber-900/20 shadow-xs animate-pulse"
              badgeEl = <Badge className="bg-amber-600 text-[9px] px-1 py-0 font-bold">OKNO</Badge>
            } else if (status === "overdue") {
              cardBg = "bg-emerald-950/25 border-emerald-500/60 dark:bg-emerald-900/25"
              badgeEl = <Badge className="bg-emerald-600 text-[9px] px-1 py-0 font-bold">STOI</Badge>
            }

            return (
              <div
                key={ch.channel}
                className={`flex flex-col justify-between rounded-xl border p-2.5 text-xs transition-colors ${cardBg}`}
              >
                <div className="flex items-center justify-between gap-1 pb-1">
                  <span className="font-heading font-bold text-xs">CH {ch.channel}</span>
                  {badgeEl}
                </div>

                {/* Countdown display */}
                <div className="flex flex-col items-center justify-center py-1.5 min-h-[50px] text-center">
                  {status === "counting" ? (
                    <>
                      <span className="font-mono text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                        {formatDuration(remainingToWindowSeconds)}
                      </span>
                      <span className="text-[9px] text-muted-foreground">do okna</span>
                    </>
                  ) : status === "window" ? (
                    <>
                      <span className="font-mono text-lg font-bold text-amber-500 dark:text-amber-400">
                        {formatDuration(remainingInWindowSeconds)}
                      </span>
                      <span className="text-[9px] font-medium text-amber-600 dark:text-amber-300">
                        W oknie respu!
                      </span>
                    </>
                  ) : status === "overdue" ? (
                    <>
                      <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatDuration(overdueSeconds)}
                      </span>
                      <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                        Boss czeka
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">Brak zbicia</span>
                  )}
                </div>

                {/* Last kill info */}
                <div className="text-[10px] text-muted-foreground border-t pt-1 mb-1.5 flex justify-between">
                  <span>Zbity:</span>
                  <span className="font-mono font-medium text-foreground">
                    {ch.lastKill ? ch.lastKill.killedAtLabel : "—"}
                  </span>
                </div>

                {/* Instant public kill button */}
                <Button
                  size="xs"
                  className="w-full text-[11px] h-7 font-medium"
                  disabled={pending}
                  onClick={() => handleKill(ch.channel)}
                >
                  Zbiłem CH{ch.channel}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
