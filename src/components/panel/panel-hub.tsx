"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { KillLogItem, RosterMember, RunSyncState } from "@/lib/queries"
import type { CustomTimerWithChannels, TimerCategoryData } from "@/lib/timers-queries"
import type { SlotId } from "@/lib/constants"
import type { EventDetails } from "@/lib/calendar-types"
import { playMapSound } from "@/lib/panel-audio"
import { PanelV3View } from "@/components/panel/panel-v3-view"
import { PanelDefaultView } from "@/components/panel/panel-default-view"
import { PanelCustomView } from "@/components/panel/panel-custom-view"
import { PanelSoundSettingsDialog } from "@/components/panel/panel-sound-settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type PanelTab = "v3" | "default" | "custom"
const PANEL_TAB_STORAGE_KEY = "v3_panel_active_tab"

export function PanelHub({
  slot,
  roster,
  v3Kills,
  syncs,
  categories,
  v3CalendarEvent,
  queenCounts,
  users,
  currentUserId,
  currentUserNick,
  isLeader,
  hasV3Role = true,
}: {
  slot: { id: SlotId; label: string; status: "trwa" | "nastepny" | "skonczony" }
  roster: RosterMember[]
  v3Kills: KillLogItem[]
  syncs: RunSyncState[]
  categories: TimerCategoryData[]
  v3CalendarEvent?: EventDetails | null
  queenCounts: { userId: string; queens: number }[]
  users: { id: string; gameNick: string }[]
  currentUserId: string
  currentUserNick?: string
  isLeader: boolean
  hasV3Role?: boolean
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<PanelTab>("default")
  const [now, setNow] = useState(0)
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false)
  const alertedWindowsRef = useRef<Set<string>>(new Set())

  // Load preferred tab from localStorage on mount
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem(PANEL_TAB_STORAGE_KEY) as PanelTab | null
      if (savedTab && (savedTab === "default" || savedTab === "custom" || (savedTab === "v3" && hasV3Role))) {
        setActiveTab(savedTab)
      } else if (!hasV3Role && savedTab === "v3") {
        setActiveTab("default")
      }
    } catch {
      // ignore
    }
  }, [hasV3Role])

  // 1-second live countdown ticker for second-screen experience
  useEffect(() => {
    setNow(Date.now()) // immediate first tick after hydration
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // 10-second automatic server refresh to pick up other players' kills
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 10000)
    return () => clearInterval(interval)
  }, [router])

  // Real-time audio alert per map when any channel enters the respawn window
  // Scoped to active tab: V3 ignores boss timers, Custom filters by selection
  useEffect(() => {
    // V3 tab has its own audio alerts via RunTimers – skip boss timer alerts
    if (activeTab === "v3") return

    let filteredCategories = categories

    if (activeTab === "custom") {
      try {
        const raw = localStorage.getItem("v3_panel_custom_timer_ids")
        if (raw) {
          const ids = JSON.parse(raw)
          if (Array.isArray(ids) && ids.length > 0) {
            filteredCategories = categories.map((cat) => ({
              ...cat,
              timers: cat.timers.filter((t) => ids.includes(t.id)),
            }))
          }
        }
      } catch {
        // ignore
      }
    }

    for (const cat of filteredCategories) {
      for (const timer of cat.timers) {
        for (const ch of timer.channels) {
          if (!ch.windowStartAt || !ch.windowEndAt) continue
          const startMs = new Date(ch.windowStartAt).getTime()
          const endMs = new Date(ch.windowEndAt).getTime()

          // Trigger alert when within the window
          if (now >= startMs && now <= endMs) {
            const alertKey = `${timer.id}_ch${ch.channel}_${ch.windowStartAt}`
            if (!alertedWindowsRef.current.has(alertKey)) {
              alertedWindowsRef.current.add(alertKey)
              playMapSound(cat.name)
            }
          }
        }
      }
    }
  }, [activeTab, categories, now])

  // Real-time dynamic browser tab title showing closest upcoming/active timer from the ACTIVE view
  useEffect(() => {
    type Candidate = {
      name: string
      status: "window" | "counting" | "overdue"
      sec: number
    }

    const inWindow: Candidate[] = []
    const counting: Candidate[] = []
    const overdue: Candidate[] = []

    function addCandidate(c: Candidate) {
      if (c.status === "window") inWindow.push(c)
      else if (c.status === "counting") counting.push(c)
      else if (c.status === "overdue") overdue.push(c)
    }

    if (activeTab === "v3") {
      // 1. Siatki (resp co 3 minuty)
      const netsSync = syncs.find((s) => s.kind === "nets")
      if (netsSync) {
        const syncedAt = new Date(netsSync.syncedAt).getTime()
        const elapsed = now - syncedAt
        const remMs = elapsed < 0 ? -elapsed : 3 * 60 * 1000 - (elapsed % (3 * 60 * 1000))
        addCandidate({
          name: "Siatki",
          status: "counting",
          sec: Math.max(0, Math.ceil(remMs / 1000)),
        })
      }

      // 2. Kokony (resp co 60 minut)
      const cocoonSync = syncs.find((s) => s.kind === "cocoons")
      if (cocoonSync) {
        const syncedAt = new Date(cocoonSync.syncedAt).getTime()
        const elapsed = now - syncedAt
        const remMs = elapsed < 0 ? -elapsed : 60 * 60 * 1000 - (elapsed % (60 * 60 * 1000))
        addCandidate({
          name: "Kokony",
          status: "counting",
          sec: Math.max(0, Math.ceil(remMs / 1000)),
        })
      }

      // 3. Królówka (okno 1 h - 2 h od zbicia minus 5 min)
      const lastQueen = v3Kills.find((k) => k.kind === "queen")
      if (lastQueen) {
        const syncedAt = new Date(lastQueen.killedAt).getTime()
        const appearedAt = syncedAt - 5 * 60 * 1000
        const earlyAt = appearedAt + 60 * 60 * 1000
        const lateAt = appearedAt + 2 * 60 * 60 * 1000

        if (now < earlyAt) {
          addCandidate({
            name: "Królówka",
            status: "counting",
            sec: Math.max(0, Math.ceil((earlyAt - now) / 1000)),
          })
        } else if (now <= lateAt) {
          addCandidate({
            name: "Królówka",
            status: "window",
            sec: Math.max(0, Math.ceil((lateAt - now) / 1000)),
          })
        } else {
          addCandidate({
            name: "Królówka",
            status: "overdue",
            sec: Math.max(0, Math.ceil((now - lateAt) / 1000)),
          })
        }
      }
    } else {
      // Widok Domyślny lub Custom
      let filteredCategories = categories

      if (activeTab === "custom") {
        try {
          const raw = localStorage.getItem("v3_panel_custom_timer_ids")
          if (raw) {
            const ids = JSON.parse(raw)
            if (Array.isArray(ids) && ids.length > 0) {
              filteredCategories = categories.map((cat) => ({
                ...cat,
                timers: cat.timers.filter((t) => ids.includes(t.id)),
              }))
            }
          }
        } catch {
          // ignore
        }
      }

      for (const cat of filteredCategories) {
        for (const timer of cat.timers) {
          for (const ch of timer.channels) {
            if (!ch.windowStartAt || !ch.windowEndAt) continue
            const startMs = new Date(ch.windowStartAt).getTime()
            const endMs = new Date(ch.windowEndAt).getTime()
            const shortName = timer.name.split(" ")[0]
            const name = `${shortName} CH${ch.channel}`

            if (now >= startMs && now <= endMs) {
              const sec = Math.max(0, Math.round((endMs - now) / 1000))
              addCandidate({ name, status: "window", sec })
            } else if (now < startMs) {
              const sec = Math.max(0, Math.round((startMs - now) / 1000))
              addCandidate({ name, status: "counting", sec })
            } else {
              const sec = Math.max(0, Math.round((now - endMs) / 1000))
              addCandidate({ name, status: "overdue", sec })
            }
          }
        }
      }
    }

    let tabText = ""
    if (inWindow.length > 0) {
      inWindow.sort((a, b) => a.sec - b.sec)
      const top = inWindow[0]
      tabText = `🔥 [OKNO ${top.name}]`
    } else if (counting.length > 0) {
      counting.sort((a, b) => a.sec - b.sec)
      const top = counting[0]
      const m = Math.floor(top.sec / 60)
      const s = top.sec % 60
      const formatted = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      tabText = `⏱️ [${formatted} ${top.name}]`
    } else if (overdue.length > 0) {
      overdue.sort((a, b) => a.sec - b.sec)
      const top = overdue[0]
      const m = Math.floor(top.sec / 60)
      const s = top.sec % 60
      const formatted = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      tabText = `⚔️ [+${formatted} ${top.name}]`
    }

    if (tabText) {
      document.title = `${tabText} Panel`
    } else {
      if (activeTab === "v3") {
        document.title = "🕷️ [V3] ElderHub"
      } else {
        document.title = "ElderHub | Panel"
      }
    }

    return () => {
      document.title = "ElderHub | Panel"
    }
  }, [activeTab, categories, syncs, v3Kills, now])

  function handleTabChange(tab: PanelTab) {
    setActiveTab(tab)
    try {
      localStorage.setItem(PANEL_TAB_STORAGE_KEY, tab)
    } catch {
      // ignore
    }
  }

  function handleKillRecorded() {
    router.refresh()
  }

  // Calculate quick stats for header badge – scoped to active view
  let windowCount = 0
  if (activeTab !== "v3") {
    let filteredTimers = categories.flatMap((c) => c.timers)
    if (activeTab === "custom") {
      try {
        const raw = localStorage.getItem("v3_panel_custom_timer_ids")
        if (raw) {
          const ids = JSON.parse(raw)
          if (Array.isArray(ids) && ids.length > 0) {
            filteredTimers = filteredTimers.filter((t) => ids.includes(t.id))
          }
        }
      } catch {
        // ignore
      }
    }
    windowCount = filteredTimers.reduce(
      (acc, t) => acc + t.channels.filter((ch) => ch.status === "window" || ch.status === "overdue").length,
      0
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold">Panel</h1>
            <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live Sync
            </Badge>
            {windowCount > 0 ? (
              <Badge className="bg-amber-600 text-white font-bold text-xs animate-bounce">
                🔥 {windowCount} {windowCount === 1 ? "aktywny resp" : "aktywne respy"}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Wygodny HUD na boku: aktualna obsada V3, zsynchronizowane timery bossów i widok custom.
          </p>
        </div>

        {/* View switcher buttons & Sound settings */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs font-medium gap-1.5 px-3 border-border/80 shadow-xs"
            onClick={() => setSoundSettingsOpen(true)}
          >
            <span>🔊</span>
            <span>Dźwięki</span>
          </Button>

          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border shadow-xs">
            {hasV3Role && (
              <Button
                size="sm"
                variant={activeTab === "v3" ? "default" : "ghost"}
                className="h-7 text-xs font-semibold px-2.5"
                onClick={() => handleTabChange("v3")}
              >
                🕷️ V3
              </Button>
            )}

            <Button
              size="sm"
              variant={activeTab === "default" ? "default" : "ghost"}
              className="h-7 text-xs font-semibold px-2.5"
              onClick={() => handleTabChange("default")}
            >
              ⚡ Domyślny
            </Button>

            <Button
              size="sm"
              variant={activeTab === "custom" ? "default" : "ghost"}
              className="h-7 text-xs font-semibold px-2.5"
              onClick={() => handleTabChange("custom")}
            >
              🛠️ Custom
            </Button>
          </div>
        </div>
      </div>

      {/* Sound Settings Dialog */}
      <PanelSoundSettingsDialog
        open={soundSettingsOpen}
        onOpenChange={setSoundSettingsOpen}
      />

      {/* View Contents */}
      {activeTab === "v3" ? (
        <PanelV3View
          slot={slot}
          roster={roster}
          kills={v3Kills}
          syncs={syncs}
          v3CalendarEvent={v3CalendarEvent}
          queenCounts={queenCounts}
          users={users}
          currentUserId={currentUserId}
          currentUserNick={currentUserNick}
          isLeader={isLeader}
        />
      ) : activeTab === "default" ? (
        <PanelDefaultView
          categories={categories}
          now={now}
          onKillRecorded={handleKillRecorded}
        />
      ) : (
        <PanelCustomView
          categories={categories}
          now={now}
          onKillRecorded={handleKillRecorded}
        />
      )}
    </div>
  )
}
