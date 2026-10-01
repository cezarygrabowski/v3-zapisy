"use client"

import { createContext, useContext, useEffect, useRef, useState, startTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { playTimerSound } from "@/lib/sound"
import type { AlertTimer } from "@/lib/alert-timer-types"

const AlertsContext = createContext<{
  timers: AlertTimer[]
  now: number
  soundEnabled: boolean
  toggleSound: () => void
} | null>(null)

export function AlertsProvider({ timers, initialNow, children }: {
  timers: AlertTimer[]
  initialNow: number
  children: ReactNode
}) {
  const [now, setNow] = useState(initialNow)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const notified = useRef(new Set<string>())
  const router = useRouter()

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const refresh = () => {
      tick()
      startTransition(() => router.refresh())
    }
    const clock = window.setInterval(tick, 1000)
    const sync = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(clock)
      window.clearInterval(sync)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [router])

  useEffect(() => {
    const fresh = timers.filter((timer) => {
      const key = `${timer.id}:${timer.readyAt}`
      if (timer.readyAt > now || notified.current.has(key)) return false
      notified.current.add(key)
      return true
    })
    if (!fresh.length) return
    toast("Alerty", {
      description: fresh.map((timer) => `${timer.characterName ?? "Ogólny"} · ${timer.name}`).join(", "),
      action: { label: "Zobacz", onClick: () => router.push("/alerty") },
    })
    if (soundEnabled) {
      try { playTimerSound("nets") } catch { /* Visual alerts remain available if audio is blocked. */ }
    }
  }, [timers, now, soundEnabled, router])

  function toggleSound() {
    if (!soundEnabled) {
      try { playTimerSound("nets") } catch { toast.error("Przeglądarka nie pozwala odtworzyć dźwięku.") }
    }
    setSoundEnabled(!soundEnabled)
  }

  return <AlertsContext value={{ timers, now, soundEnabled, toggleSound }}>{children}</AlertsContext>
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) throw new Error("AlertsProvider is required")
  return context
}
