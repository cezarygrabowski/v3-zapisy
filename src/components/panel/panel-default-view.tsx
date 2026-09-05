"use client"

import type { TimerCategoryData } from "@/lib/timers-queries"
import { PanelTimerCard } from "@/components/panel/panel-timer-card"
import { Badge } from "@/components/ui/badge"

export function PanelDefaultView({
  categories,
  now,
  onKillRecorded,
}: {
  categories: TimerCategoryData[]
  now?: number
  onKillRecorded?: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Informational banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 border p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-bold">Domyślny zestaw bossów</h2>
            <Badge variant="secondary" className="gap-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Współdzielony w gildii
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zestaw najważniejszych bossów terenowych (Red Las, Sohan, Pustynia, Dolina, Ognista). Każde odkliknięcie widzą natychmiast wszyscy gracze.
          </p>
        </div>
      </div>

      {/* Map categories with their timers */}
      <div className="flex flex-col gap-6">
        {categories.map((cat) => {
          if (cat.timers.length === 0) return null

          return (
            <div key={cat.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b pb-1.5">
                <span className="text-xl">{cat.icon}</span>
                <h3 className="font-heading font-bold text-base">{cat.name}</h3>
                <Badge variant="outline" className="text-[10px] ml-1 font-mono">
                  {cat.timers.length} {cat.timers.length === 1 ? "boss" : "bossy"}
                </Badge>
              </div>

              <div className="flex flex-col gap-3">
                {cat.timers.map((timer) => (
                  <PanelTimerCard
                    key={timer.id}
                    timer={timer}
                    mapName={cat.name}
                    mapIcon={cat.icon}
                    now={now}
                    onKillRecorded={onKillRecorded}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
