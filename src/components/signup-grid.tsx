"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  playstyleLabel,
  positionLabel,
  POSITIONS,
  SLOTS,
  slotLabel,
  type PositionId,
  type SlotId,
} from "@/lib/constants"
import { slotHasStarted } from "@/lib/dates"
import {
  leaderAssign,
  leaderRemove,
  signOutOfSlot,
  signUp,
} from "@/lib/actions/signups"
import type { GridSignup } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"

type Cell = {
  slot: SlotId
  position: PositionId
  signup: GridSignup | null
}

type GuildUser = {
  id: string
  gameNick: string
  playstyle: string | null
}

export function SignupGrid({
  date,
  cells,
  currentUserId,
  isLeader,
  mySignup,
  users,
}: {
  date: string
  cells: Cell[]
  currentUserId: string
  isLeader: boolean
  mySignup: (GridSignup & { slot: SlotId; position: PositionId }) | null
  users: GuildUser[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [assignCell, setAssignCell] = useState<{
    slot: SlotId
    position: PositionId
  } | null>(null)
  const [assignUserId, setAssignUserId] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string; code?: string }>) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        if (result.code === "NEED_PLAYSTYLE") {
          toast.error(result.error)
          router.push("/konto")
          return
        }
        toast.error(result.error)
        return
      }
      toast.success("Zapisano zmianę")
    })
  }

  const assignItems = users.map((user) => ({
    value: user.id,
    label: `${user.gameNick}${user.playstyle ? ` · ${user.playstyle.toUpperCase()}` : " · brak PVP/PVM"}`,
  }))

  return (
    <div className="flex flex-col gap-4">
      {mySignup ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Jesteś zapisany tego dnia:{" "}
          <span className="font-medium">
            {slotLabel(mySignup.slot)} · {positionLabel(mySignup.position)}
          </span>
          <Badge variant="outline" className="ml-2">
            {mySignup.feeKk} kk
          </Badge>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        {SLOTS.map((slot) => (
          <section key={slot.id} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <h2 className="mb-3 font-medium">{slot.label}</h2>
            <div className="flex flex-col gap-2">
              {POSITIONS.map((position) => {
                const cell = cells.find(
                  (item) => item.slot === slot.id && item.position === position.id
                )!
                return (
                  <CellRow
                    key={`${slot.id}-${position.id}`}
                    date={date}
                    cell={cell}
                    currentUserId={currentUserId}
                    isLeader={isLeader}
                    pending={pending}
                    onSign={() => run(() => signUp({ date, slot: slot.id, position: position.id }))}
                    onLeave={(id) => run(() => signOutOfSlot(id))}
                    onRemove={(id) => run(() => leaderRemove(id))}
                    onAssign={() => {
                      setAssignUserId(null)
                      setAssignCell({ slot: slot.id, position: position.id })
                    }}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={Boolean(assignCell)} onOpenChange={(open) => !open && setAssignCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wpisz gracza</DialogTitle>
            <DialogDescription>
              {assignCell
                ? `${slotLabel(assignCell.slot)} · ${positionLabel(assignCell.position)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Gracz</FieldLabel>
              <Select
                items={assignItems}
                value={assignUserId}
                onValueChange={(value) => setAssignUserId((value as string | null) ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wybierz nick" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {assignItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignCell(null)}>
              Anuluj
            </Button>
            <Button
              disabled={!assignUserId || pending}
              onClick={() => {
                if (!assignCell || !assignUserId) return
                run(() =>
                  leaderAssign({
                    date,
                    slot: assignCell.slot,
                    position: assignCell.position,
                    userId: assignUserId,
                  })
                )
                setAssignCell(null)
              }}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Wpisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CellRow({
  date,
  cell,
  currentUserId,
  isLeader,
  pending,
  onSign,
  onLeave,
  onRemove,
  onAssign,
}: {
  date: string
  cell: Cell
  currentUserId: string
  isLeader: boolean
  pending: boolean
  onSign: () => void
  onLeave: (id: string) => void
  onRemove: (id: string) => void
  onAssign: () => void
}) {
  const started = slotHasStarted(date, cell.slot)
  const mine = cell.signup?.userId === currentUserId
  const canSelfSign = !cell.signup
  const canSelfLeave = mine && (!started || isLeader)

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-2",
        mine && "bg-muted/60 ring-1 ring-primary/40"
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{positionLabel(cell.position)}</span>
        {cell.signup ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{cell.signup.gameNick}</span>
            {cell.signup.playstyle ? (
              <Badge variant="secondary">{playstyleLabel(cell.signup.playstyle)}</Badge>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">wolne</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {canSelfSign ? (
          <Button size="sm" disabled={pending} onClick={onSign}>
            Zapisz się
          </Button>
        ) : null}
        {canSelfLeave && cell.signup ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onLeave(cell.signup!.id)}
          >
            Wypisz się
          </Button>
        ) : null}
        {isLeader ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>
              Admin
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onAssign}>Wpisz kogoś</DropdownMenuItem>
                {cell.signup ? (
                  <DropdownMenuItem onClick={() => onRemove(cell.signup!.id)}>
                    Wyrzuć
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}
