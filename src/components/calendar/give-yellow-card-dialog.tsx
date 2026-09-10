"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { giveYellowCard } from "@/lib/actions/penalties"
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
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { AlertTriangleIcon } from "lucide-react"

export function GiveYellowCardDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUserNick,
  eventId,
  onCardIssued,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetUserId: string | null
  targetUserNick: string
  eventId?: string
  onCardIssued?: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState("")

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setReason("")
    }
    onOpenChange(isOpen)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetUserId || !reason.trim()) return

    startTransition(async () => {
      const res = await giveYellowCard({
        userId: targetUserId,
        reason: reason.trim(),
        eventId,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message || "Nadano żółtą kartkę.")
      onOpenChange(false)
      onCardIssued?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">🟨</span>
              <span>Nadaj żółtą kartkę: {targetUserNick}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ukarany gracz będzie ograniczony w wyprzedzeniu zapisów na wydarzenia V3 zgodnie z regułami kar gildii.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-3">
            {/* Penalty rules callout */}
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex flex-col gap-1 text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangleIcon className="size-3.5 shrink-0" />
                <span>Stopnie kar w systemie (konfigurowalne w panelu Admina):</span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Kolejny stopień (1, 2, 3+) oraz czas trwania kary i limit wyprzedzenia zapisu są wyliczane automatycznie według aktywnych reguł w panelu Admina.
              </p>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="yellow-card-reason">Powód / wyjaśnienie kary</FieldLabel>
                <Input
                  id="yellow-card-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="np. Brak obecności na slocie 14:00, brak kontaktu..."
                  required
                  className="text-xs"
                />
              </Field>
            </FieldGroup>
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
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
              disabled={pending || !reason.trim()}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Nadaj żółtą kartkę
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
