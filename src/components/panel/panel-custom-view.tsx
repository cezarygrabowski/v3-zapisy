"use client"

import { useEffect, useState } from "react"
import type { TimerCategoryData } from "@/lib/timers-queries"
import { PanelTimerCard } from "@/components/panel/panel-timer-card"
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

const CUSTOM_TIMERS_STORAGE_KEY = "v3_panel_custom_timer_ids"

export function PanelCustomView({
  categories,
  now,
  onKillRecorded,
}: {
  categories: TimerCategoryData[]
  now?: number
  onKillRecorded?: () => void
}) {
  const [selectedTimerIds, setSelectedTimerIds] = useState<string[]>([])
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Load user custom selection from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_TIMERS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedTimerIds(parsed)
          setHasInitialized(true)
          return
        }
      }
    } catch {
      // ignore
    }

    // Default selection if none saved: pick the first timer from each category
    const defaultIds = categories.flatMap((c) => c.timers.slice(0, 1).map((t) => t.id))
    setSelectedTimerIds(defaultIds)
    setHasInitialized(true)
  }, [categories])

  function handleSaveSelection(newIds: string[]) {
    setSelectedTimerIds(newIds)
    try {
      localStorage.setItem(CUSTOM_TIMERS_STORAGE_KEY, JSON.stringify(newIds))
    } catch {
      // ignore
    }
  }

  function toggleTimer(id: string) {
    const next = selectedTimerIds.includes(id)
      ? selectedTimerIds.filter((tId) => tId !== id)
      : [...selectedTimerIds, id]
    handleSaveSelection(next)
  }

  function selectAllInCat(cat: TimerCategoryData) {
    const catTimerIds = cat.timers.map((t) => t.id)
    const allSelected = catTimerIds.every((id) => selectedTimerIds.includes(id))
    if (allSelected) {
      handleSaveSelection(selectedTimerIds.filter((id) => !catTimerIds.includes(id)))
    } else {
      const merged = Array.from(new Set([...selectedTimerIds, ...catTimerIds]))
      handleSaveSelection(merged)
    }
  }

  // Flatten and filter selected timers
  const selectedTimersWithMeta = categories.flatMap((cat) =>
    cat.timers
      .filter((t) => selectedTimerIds.includes(t.id))
      .map((t) => ({ timer: t, mapName: cat.name, mapIcon: cat.icon }))
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 border p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-bold">Twój Customowy HUD</h2>
            <Badge variant="secondary" className="text-xs font-mono">
              {selectedTimersWithMeta.length} obserwowanych
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zdefiniuj własny zestaw bossów na jednym ekranie (np. Red Las + Sohan). Stan zapamiętany w Twojej przeglądarce.
          </p>
        </div>

        {/* Configuration Modal Trigger */}
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <Button
            size="sm"
            className="gap-1.5 font-medium text-xs h-8"
            onClick={() => setIsConfigOpen(true)}
          >
            <span>⚙️</span>
            <span>Skonfiguruj widok</span>
          </Button>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Wybierz bossy do obserwowania</DialogTitle>
              <DialogDescription className="text-xs">
                Zaznacz bossy i mapy, które chcesz widzieć w swoim Panelu operacyjnym.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-3">
              {categories.map((cat) => {
                const catTimerIds = cat.timers.map((t) => t.id)
                const allSelected = catTimerIds.length > 0 && catTimerIds.every((id) => selectedTimerIds.includes(id))

                return (
                  <div key={cat.id} className="rounded-xl border p-3 flex flex-col gap-2 bg-muted/10">
                    <div className="flex items-center justify-between border-b pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.icon}</span>
                        <span className="font-bold text-sm">{cat.name}</span>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-[11px] h-6 px-1.5"
                        onClick={() => selectAllInCat(cat)}
                      >
                        {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                      </Button>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      {cat.timers.map((t) => {
                        const isChecked = selectedTimerIds.includes(t.id)
                        return (
                          <label
                            key={t.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 cursor-pointer text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleTimer(t.id)}
                              />
                              <span className="font-medium">{t.name}</span>
                            </div>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {t.respawnMinMinutes === t.respawnMaxMinutes
                                ? `${t.respawnMinMinutes}m`
                                : `${t.respawnMinMinutes}–${t.respawnMaxMinutes}m`}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <DialogFooter>
              <Button onClick={() => setIsConfigOpen(false)}>
                Gotowe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selected Bosses Cards */}
      {selectedTimersWithMeta.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center flex flex-col items-center justify-center gap-2">
          <p className="text-base font-semibold">Brak zaznaczonych bossów</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Kliknij „Skonfiguruj widok” u góry i zaznacz interesujące Cię bossy (np. Red Las, Sohan).
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 text-xs"
            onClick={() => setIsConfigOpen(true)}
          >
            ⚙️ Wybierz bossy
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {selectedTimersWithMeta.map(({ timer, mapName, mapIcon }) => (
            <PanelTimerCard
              key={timer.id}
              timer={timer}
              mapName={mapName}
              mapIcon={mapIcon}
              now={now}
              onKillRecorded={onKillRecorded}
            />
          ))}
        </div>
      )}
    </div>
  )
}
