"use client"

import { useState, useTransition, useMemo } from "react"
import { toast } from "sonner"
import { transferSpotToUser } from "@/lib/actions/calendar"
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
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { SearchIcon, UserCheckIcon, UsersIcon } from "lucide-react"

export function SpotTransferDialog({
  open,
  onOpenChange,
  signupId,
  currentSpot,
  currentOwnerNick,
  allUsers,
  existingParticipantUserIds = [],
  onTransferred,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  signupId: string
  currentSpot: string | null
  currentOwnerNick: string
  allUsers: { id: string; gameNick: string }[]
  existingParticipantUserIds?: string[]
  onTransferred?: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const candidateUsers = useMemo(() => {
    const existingSet = new Set(existingParticipantUserIds)
    return allUsers
      .filter((u) => !existingSet.has(u.id))
      .sort((a, b) => a.gameNick.localeCompare(b.gameNick, "pl"))
  }, [allUsers, existingParticipantUserIds])

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidateUsers
    return candidateUsers.filter((u) => u.gameNick.toLowerCase().includes(q))
  }, [candidateUsers, search])

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setSelectedUserId(null)
      setSearch("")
    }
    onOpenChange(isOpen)
  }

  function handleTransfer() {
    if (!selectedUserId) return
    startTransition(async () => {
      const res = await transferSpotToUser({
        signupId,
        targetUserId: selectedUserId,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message || "Pomyślnie przekazano miejscówkę!")
      onOpenChange(false)
      onTransferred?.()
    })
  }

  const selectedUserNick = candidateUsers.find((u) => u.id === selectedUserId)?.gameNick

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UsersIcon className="size-4 text-purple-500" />
            <span>Przekaż miejscówkę (Zastępstwo)</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Wpisz inną osobę na swoje miejsce. Nawet w czasie poniżej 2h przed startem nie otrzymasz kary, ponieważ slot ma pełną obsadę.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* Current slot info banner */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Twój spot:</span>
              <Badge variant="outline" className="font-bold">
                {currentSpot || "Miejscówka"}
              </Badge>
            </div>
            <span className="text-muted-foreground truncate max-w-[150px]">
              Obecny: <strong className="text-foreground">{currentOwnerNick}</strong>
            </span>
          </div>

          {/* Search box */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj zastępcy po nicku..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Candidates list */}
          <div className="border rounded-lg max-h-[220px] overflow-y-auto divide-y text-xs">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                Brak dostępnych graczy do wyboru.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUserId === user.id

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
                      isSelected ? "bg-purple-500/10 font-semibold text-purple-700 dark:text-purple-300" : ""
                    }`}
                  >
                    <span className="truncate">{user.gameNick}</span>
                    {isSelected && (
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <UserCheckIcon className="size-3.5" /> Wybrany
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {selectedUserNick && (
            <p className="text-[11px] text-muted-foreground">
              Miejscówkę przejmie: <strong className="text-foreground">{selectedUserNick}</strong>
            </p>
          )}
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
            onClick={handleTransfer}
            disabled={pending || !selectedUserId}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Przekaż spot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
