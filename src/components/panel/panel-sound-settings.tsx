"use client"

import { useEffect, useState } from "react"
import {
  SOUND_OPTIONS,
  type SoundType,
  getStoredMapSounds,
  saveStoredMapSound,
  isAudioAlertsEnabled,
  setAudioAlertsEnabled,
  getAudioVolume,
  setAudioVolume,
  playSound,
} from "@/lib/panel-audio"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const MAPS_CONFIG: { key: string; name: string; icon: string }[] = [
  { key: "v3", name: "Loch Pająków V3", icon: "🕷️" },
  { key: "Loch Pająków V1", name: "Loch Pająków V1", icon: "🕸️" },
  { key: "Red Las", name: "Red Las", icon: "🌲" },
  { key: "Góra Sohan", name: "Góra Sohan", icon: "❄️" },
  { key: "Świątynia Hwang", name: "Świątynia Hwang", icon: "⛩️" },
  { key: "Ognista Ziemia", name: "Ognista Ziemia", icon: "🌋" },
  { key: "default", name: "Pozostałe mapy / Inne", icon: "⚔️" },
]

export function PanelSoundSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [enabled, setEnabled] = useState(true)
  const [volume, setVolumeState] = useState(70)
  const [mapSounds, setMapSounds] = useState<Record<string, SoundType>>({})

  useEffect(() => {
    if (open) {
      setEnabled(isAudioAlertsEnabled())
      setVolumeState(Math.round(getAudioVolume() * 100))
      setMapSounds(getStoredMapSounds())
    }
  }, [open])

  function handleToggleEnabled(val: boolean) {
    setEnabled(val)
    setAudioAlertsEnabled(val)
  }

  function handleVolumeChange(val: number) {
    setVolumeState(val)
    setAudioVolume(val / 100)
  }

  function handleSoundSelect(mapKey: string, sound: SoundType) {
    const next = { ...mapSounds, [mapKey]: sound }
    setMapSounds(next)
    saveStoredMapSound(mapKey, sound)
  }

  function handleTestSound(sound: SoundType) {
    playSound(sound, volume / 100)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl">🔊</span>
            <DialogTitle>Ustawienia Dźwięków i Powiadomień</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Skonfiguruj unikalny sygnał dźwiękowy dla każdej mapy. Dźwięki generowane są lokalnie
            przez Web Audio API, dzięki czemu działają natychmiast i bez opóźnień sieciowych.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Master toggle & Volume */}
          <div className="flex flex-col gap-3 rounded-xl border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold flex items-center gap-2">
                  <span>Powiadomienia dźwiękowe</span>
                  {enabled ? (
                    <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      Włączone
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Wyciszone
                    </Badge>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Odtwarzaj dźwięk, gdy boss wchodzi w okno respu.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
            </div>

            {enabled ? (
              <div className="flex items-center gap-4 pt-2 border-t">
                <span className="text-xs font-medium shrink-0">Głośność: {volume}%</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
              </div>
            ) : null}
          </div>

          {/* Per-map sounds list */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dźwięk dla danej mapy
              </span>
              <span className="text-[11px] text-muted-foreground">
                Kliknij ▶ aby odsłuchać
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {MAPS_CONFIG.map((map) => {
                const currentSound = mapSounds[map.key] || mapSounds.default || "chime"

                return (
                  <div
                    key={map.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border p-2.5 bg-card hover:bg-muted/15 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <span className="text-base">{map.icon}</span>
                      <span className="text-xs font-semibold">{map.name}</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={currentSound}
                        onChange={(e) => handleSoundSelect(map.key, e.target.value as SoundType)}
                        className="h-8 w-full sm:w-[190px] rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {SOUND_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-8 px-2.5 shrink-0 gap-1 text-xs"
                        onClick={() => handleTestSound(currentSound)}
                      >
                        <span>▶</span>
                        <span className="hidden sm:inline">Test</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Zamknij</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
