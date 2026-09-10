"use client"

import { useState, useTransition, useMemo } from "react"
import { toast } from "sonner"
import { recordBaronKill } from "@/lib/actions/run"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { SearchIcon, UsersIcon, XCircleIcon } from "lucide-react"

export function BaronKillDialog({
  open,
  onOpenChange,
  users,
  currentUserId,
  currentUserNick,
  suggestedHelperIds = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: { id: string; gameNick: string }[]
  currentUserId: string
  currentUserNick?: string
  suggestedHelperIds?: string[]
}) {
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [selectedHelpers, setSelectedHelpers] = useState<Set<string>>(() => {
    return new Set(suggestedHelperIds.filter((id) => id && id !== currentUserId))
  })

  // Keep suggested helpers in sync when opening dialog
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelectedHelpers(
        new Set(suggestedHelperIds.filter((id) => id && id !== currentUserId))
      )
      setSearch("")
    }
    onOpenChange(isOpen)
  }

  // Filter out current user from candidate helpers
  const selectableUsers = useMemo(() => {
    return users
      .filter((u) => u.id !== currentUserId)
      .sort((a, b) => a.gameNick.localeCompare(b.gameNick, "pl"))
  }, [users, currentUserId])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return selectableUsers
    return selectableUsers.filter((u) => u.gameNick.toLowerCase().includes(q))
  }, [selectableUsers, search])

  const toggleHelper = (userId: string) => {
    setSelectedHelpers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const selectCurrentV3Roster = () => {
    setSelectedHelpers((prev) => {
      const next = new Set(prev)
      for (const id of suggestedHelperIds) {
        if (id && id !== currentUserId) {
          next.add(id)
        }
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedHelpers(new Set())
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const helperIds = Array.from(selectedHelpers)
      const res = await recordBaronKill(helperIds)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message || "Zapisano zbicie Baronowej!")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <span>👑</span>
            <span>Zbicie Baronowej Pająków V3</span>
          </DialogTitle>
          <DialogDescription>
            Kto bił Baronową razem z Tobą? Wybierz osoby ze składu spośród wszystkich graczy.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* Reporter indicator */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-amber-700 dark:text-amber-300">Zgłaszający zbicie:</span>
              <span className="font-bold">{currentUserNick || "Ty"}</span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
              Główny
            </Badge>
          </div>

          {/* Quick Helper Tools */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Wybrani pomocnicy:</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {selectedHelpers.size} os.
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              {suggestedHelperIds.length > 0 && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="h-6 text-[11px] gap-1"
                  onClick={selectCurrentV3Roster}
                >
                  <UsersIcon className="size-3" />
                  Skład z V3
                </Button>
              )}
              {selectedHelpers.size > 0 && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-6 text-[11px] text-muted-foreground hover:text-destructive gap-1"
                  onClick={clearSelection}
                >
                  <XCircleIcon className="size-3" />
                  Wyczyść
                </Button>
              )}
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj gracza po nicku..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Users List with Checkboxes */}
          <div className="border rounded-lg max-h-[260px] overflow-y-auto divide-y">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Nie znaleziono gracza o nicku „{search}”.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isChecked = selectedHelpers.has(u.id)
                const isSuggested = suggestedHelperIds.includes(u.id)

                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer select-none transition-colors hover:bg-muted/50 ${
                      isChecked ? "bg-primary/5 font-medium" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleHelper(u.id)}
                      />
                      <span className="truncate">{u.gameNick}</span>
                      {isSuggested && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          (na slocie V3)
                        </span>
                      )}
                    </div>
                    {isChecked && (
                      <span className="text-[10px] text-primary font-semibold shrink-0">
                        W składzie ✓
                      </span>
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs"
            onClick={handleSubmit}
            disabled={pending}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Zapisz zbicie ({selectedHelpers.size + 1} os.)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
