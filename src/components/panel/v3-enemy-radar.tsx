"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  clearAllV3Enemies,
  deleteV3Enemy,
  quickAddV3Enemy,
  toggleV3EnemyStatus,
} from "@/lib/actions/enemies"
import type { V3EnemyItem } from "@/lib/enemy-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { AlertTriangle, CheckCircle2, Plus, Search, ShieldAlert, Trash2, Users, X } from "lucide-react"

function formatMinutesAgo(isoDate: string | null): string {
  if (!isoDate) return ""
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diffMs / (60 * 1000))
  if (mins <= 0) return "przed chwilą"
  if (mins === 1) return "1 min temu"
  if (mins < 60) return `${mins} min temu`
  const hours = Math.floor(mins / 60)
  return `${hours}h temu`
}

export function V3EnemyRadar({
  initialEnemies = [],
  isLeader = false,
  enemies: controlledEnemies,
  onEnemiesChange,
}: {
  initialEnemies?: V3EnemyItem[]
  isLeader?: boolean
  enemies?: V3EnemyItem[]
  onEnemiesChange?: (updater: (prev: V3EnemyItem[]) => V3EnemyItem[]) => void
}) {
  const [localEnemies, setLocalEnemies] = useState<V3EnemyItem[]>(initialEnemies)
  const enemies = controlledEnemies ?? localEnemies

  const updateEnemies = (updater: (prev: V3EnemyItem[]) => V3EnemyItem[]) => {
    if (onEnemiesChange) {
      onEnemiesChange(updater)
    } else {
      setLocalEnemies(updater)
    }
  }

  const [pending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")

  // Quick-add form inputs
  const [newNick, setNewNick] = useState("")
  const [newGuild, setNewGuild] = useState("")
  const [newClass, setNewClass] = useState<string>("Wojownik")
  const [showAddForm, setShowAddForm] = useState(false)

  // Keep local state in sync if initialEnemies change and no controlled state
  useEffect(() => {
    if (!controlledEnemies) {
      setLocalEnemies(initialEnemies)
    }
  }, [initialEnemies, controlledEnemies])

  const activeEnemies = useMemo(
    () => enemies.filter((e) => e.isInsideV3),
    [enemies]
  )

  const filteredEnemies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return enemies
    return enemies.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.guild && e.guild.toLowerCase().includes(q)) ||
        (e.characterClass && e.characterClass.toLowerCase().includes(q))
    )
  }, [enemies, searchQuery])

  // 1-Click Toggle: 0ms visual update
  const handleToggle = (enemyId: string) => {
    // Optimistic UI update
    updateEnemies((prev) =>
      prev.map((e) => {
        if (e.id === enemyId) {
          const nextInside = !e.isInsideV3
          return {
            ...e,
            isInsideV3: nextInside,
            spottedAt: nextInside ? new Date().toISOString() : null,
          }
        }
        return e
      })
    )

    startTransition(async () => {
      const res = await toggleV3EnemyStatus(enemyId)
      if (!res.ok) {
        toast.error(res.error || "Błąd zmiany statusu wroga.")
        // Rollback
        updateEnemies(() => initialEnemies)
      } else {
        toast.success(res.message)
      }
    })
  }

  // Clear all active enemies (Czysto)
  const handleClearAll = () => {
    if (activeEnemies.length === 0) return

    updateEnemies((prev) =>
      prev.map((e) => ({
        ...e,
        isInsideV3: false,
        spottedAt: null,
      }))
    )

    startTransition(async () => {
      const res = await clearAllV3Enemies()
      if (!res.ok) {
        toast.error(res.error || "Błąd resetowania statusu.")
        updateEnemies(() => initialEnemies)
      } else {
        toast.success("V3 oznaczone jako czyste!")
      }
    })
  }

  // Quick Add
  const handleQuickAdd = (markInside: boolean) => {
    const nick = newNick.trim()
    if (!nick || nick.length < 2) {
      toast.error("Podaj nick wroga (min. 2 znaki).")
      return
    }

    startTransition(async () => {
      const res = await quickAddV3Enemy({
        name: nick,
        guild: newGuild.trim() || undefined,
        characterClass: newClass,
        markInside,
      })

      if (!res.ok) {
        toast.error(res.error || "Nie udało się dodać wroga.")
      } else {
        toast.success(res.message)
        setNewNick("")
        setNewGuild("")
        setShowAddForm(false)
        if (res.data) {
          updateEnemies((prev) => {
            const exists = prev.some((e) => e.name.toLowerCase() === res.data!.name.toLowerCase())
            if (exists) {
              return prev.map((e) =>
                e.name.toLowerCase() === res.data!.name.toLowerCase() ? res.data! : e
              )
            }
            return [res.data!, ...prev]
          })
        }
      }
    })
  }

  // Delete enemy from permanent list
  const handleDeleteEnemy = (enemyId: string, enemyName: string) => {
    if (!confirm(`Czy na pewno usunąć wroga „${enemyName}” z bazy?`)) return

    updateEnemies((prev) => prev.filter((e) => e.id !== enemyId))

    startTransition(async () => {
      const res = await deleteV3Enemy(enemyId)
      if (!res.ok) {
        toast.error(res.error || "Błąd usuwania wroga.")
        updateEnemies(() => initialEnemies)
      } else {
        toast.success("Usunięto z listy.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. TOP ALARM BANNER (When enemies are in V3) */}
      {activeEnemies.length > 0 ? (
        <div className="relative overflow-hidden rounded-xl border-2 border-red-500/70 bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 p-4 text-white shadow-lg animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="relative flex h-4 w-4 shrink-0 mt-0.5 sm:mt-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-black text-base text-red-200 tracking-wide uppercase flex items-center gap-1.5">
                    <ShieldAlert className="size-5 text-red-400" />
                    WRÓG W V3 ({activeEnemies.length})
                  </span>
                </div>

                {/* List of currently spotted enemies */}
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {activeEnemies.map((enemy) => (
                    <div
                      key={enemy.id}
                      className="inline-flex items-center gap-1.5 bg-red-950/90 border border-red-500/60 text-red-100 rounded-lg px-2.5 py-1 text-xs shadow-xs"
                    >
                      <span className="font-bold">{enemy.name}</span>
                      {enemy.guild ? (
                        <span className="text-red-300/80 text-[11px]">[{enemy.guild}]</span>
                      ) : null}
                      {enemy.spottedAt ? (
                        <span className="text-[10px] text-red-300/70 font-mono">
                          • {formatMinutesAgo(enemy.spottedAt)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleToggle(enemy.id)}
                        disabled={pending}
                        title="Odznacz (zszedł z V3)"
                        className="ml-1 text-red-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAll}
              disabled={pending}
              className="bg-red-950/80 hover:bg-red-900 border-red-500/50 text-white font-semibold text-xs h-8 shrink-0 gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>Wszyscy zeszli / Czysto</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Status neutralny: czysto */
        <div className="flex items-center justify-between bg-emerald-950/15 border border-emerald-500/25 rounded-xl px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Radar V3: <strong>Czysto</strong> (brak zgłoszonych wrogów w komnacie)</span>
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Kliknij wroga poniżej, aby natychmiast go oznaczyć (1 klik).
          </span>
        </div>
      )}

      {/* 2. RADAR CARD & QUICK-TOGGLE ROSTER */}
      <Card className="border shadow-xs">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Users className="size-4 text-primary" />
                <span>Radar Wrogów ({enemies.length})</span>
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                {activeEnemies.length > 0 ? `${activeEnemies.length} w V3` : "Czysto"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter / Search input */}
              <div className="relative w-36 sm:w-44">
                <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Szukaj wroga..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs pl-7"
                />
              </div>

              {/* Add enemy toggle button */}
              <Button
                size="xs"
                variant={showAddForm ? "secondary" : "outline"}
                onClick={() => setShowAddForm(!showAddForm)}
                className="h-7 text-xs gap-1"
              >
                <Plus className="size-3" />
                <span>Dodaj</span>
              </Button>
            </div>
          </div>

          {/* Quick-add inline form */}
          {showAddForm ? (
            <div className="mt-3 pt-3 border-t flex flex-col gap-2 bg-background/50 p-2.5 rounded-lg border">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Input
                  placeholder="Nick wroga w grze *"
                  value={newNick}
                  onChange={(e) => setNewNick(e.target.value)}
                  className="h-8 text-xs flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleQuickAdd(true)
                  }}
                />
                <Input
                  placeholder="Gildia (opcjonalnie)"
                  value={newGuild}
                  onChange={(e) => setNewGuild(e.target.value)}
                  className="h-8 text-xs sm:w-36"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleQuickAdd(true)
                  }}
                />
                <select
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="h-8 text-xs rounded-md border bg-background px-2.5 text-foreground"
                >
                  <option value="Wojownik">Wojownik</option>
                  <option value="Ninja">Ninja</option>
                  <option value="Sura">Sura</option>
                  <option value="Szaman">Szaman</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Wciśnij Enter lub kliknij:
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    className="h-7 text-xs"
                  >
                    Anuluj
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={pending || !newNick.trim()}
                    onClick={() => handleQuickAdd(false)}
                    className="h-7 text-xs"
                  >
                    Dodaj do bazy
                  </Button>
                  <Button
                    size="xs"
                    disabled={pending || !newNick.trim()}
                    onClick={() => handleQuickAdd(true)}
                    className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white font-bold gap-1"
                  >
                    <AlertTriangle className="size-3" />
                    Dodaj i oznacz w V3!
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="p-3">
          {filteredEnemies.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground flex flex-col items-center gap-2">
              <p>Brak wrogów na liście {searchQuery ? `dla „${searchQuery}”` : ""}.</p>
              {!searchQuery ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setShowAddForm(true)}
                  className="text-xs h-7 gap-1 mt-1"
                >
                  <Plus className="size-3" />
                  Dodaj pierwszego wroga do bazy
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredEnemies.map((enemy) => {
                const isInside = enemy.isInsideV3

                return (
                  <div
                    key={enemy.id}
                    className={`group relative flex items-center rounded-xl border transition-all select-none shadow-2xs ${
                      isInside
                        ? "bg-red-500/15 border-red-500/80 text-red-950 dark:text-red-200 ring-1 ring-red-500/50"
                        : "bg-card hover:bg-muted/40 border-border/80 text-foreground"
                    }`}
                  >
                    {/* The 1-click toggle button */}
                    <button
                      type="button"
                      onClick={() => handleToggle(enemy.id)}
                      disabled={pending}
                      className="flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                    >
                      {/* Status indicator dot */}
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 transition-colors ${
                          isInside ? "bg-red-500 animate-pulse" : "bg-muted-foreground/30"
                        }`}
                      />

                      <div className="flex flex-col min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-bold truncate ${
                              isInside ? "text-red-600 dark:text-red-400" : ""
                            }`}
                          >
                            {enemy.name}
                          </span>
                          {enemy.characterClass ? (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              ({enemy.characterClass})
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                          {enemy.guild ? (
                            <span className="font-semibold text-foreground/80 truncate">
                              [{enemy.guild}]
                            </span>
                          ) : null}
                          {isInside && enemy.spottedAt ? (
                            <span className="font-mono text-red-600 dark:text-red-400 font-bold">
                              • {formatMinutesAgo(enemy.spottedAt)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* State badge */}
                      <div className="ml-1.5">
                        {isInside ? (
                          <Badge className="bg-red-600 text-white font-bold text-[9px] h-4.5 px-1.5 shadow-xs">
                            W V3
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                            odznaczony
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Delete button (leader only or hover) */}
                    {isLeader ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteEnemy(enemy.id, enemy.name)
                        }}
                        disabled={pending}
                        title="Usuń wroga z listy"
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-opacity mr-1"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
