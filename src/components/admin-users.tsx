"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createUser, setLeader, setPlaystyle, setUserPassword } from "@/lib/actions/admin"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Row = {
  id: string
  gameNick: string
  discordName: string
  login: string | null
  hasDiscord: boolean
  playstyle: string | null
  isLeader: boolean
}

export function AdminUsers({ users }: { users: Row[] }) {
  const [pending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordUser, setPasswordUser] = useState<Row | null>(null)

  function run(
    action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) toast.error(result.error)
      else toast.success(result.message ?? "Zapisano")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Button size="sm" className="self-start" onClick={() => setCreateOpen(true)}>
        Nowe konto (login)
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nick</TableHead>
            <TableHead>Wejście</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.gameNick}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  {user.hasDiscord ? <Badge variant="secondary">Discord</Badge> : null}
                  {user.login ? (
                    <Badge variant="outline">{user.login}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">brak loginu</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <ToggleGroup
                  value={user.playstyle ? [user.playstyle] : []}
                  onValueChange={(value) => {
                    const next = value[0]
                    if (next === "pvp" || next === "pvm") {
                      run(() => setPlaystyle(user.id, next))
                    }
                  }}
                  spacing={1}
                  size="sm"
                  disabled={pending}
                >
                  <ToggleGroupItem value="pvp">PVP</ToggleGroupItem>
                  <ToggleGroupItem value="pvm">PVM</ToggleGroupItem>
                </ToggleGroup>
                {!user.playstyle ? (
                  <Badge variant="outline" className="mt-1">
                    brak
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                <Switch
                  checked={user.isLeader}
                  disabled={pending}
                  onCheckedChange={(checked) => run(() => setLeader(user.id, checked))}
                  aria-label={`Admin ${user.gameNick}`}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setPasswordUser(user)}>
                  Hasło
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateUserDialog
        open={createOpen}
        pending={pending}
        onOpenChange={setCreateOpen}
        onCreate={(input) => {
          run(async () => {
            const result = await createUser(input)
            if (result.ok) setCreateOpen(false)
            return result
          })
        }}
      />

      <PasswordDialog
        key={passwordUser?.id ?? "closed"}
        user={passwordUser}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setPasswordUser(null)
        }}
        onSave={(input) => {
          run(async () => {
            const result = await setUserPassword(input)
            if (result.ok) setPasswordUser(null)
            return result
          })
        }}
      />
    </div>
  )
}

function CreateUserDialog({
  open,
  pending,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: {
    gameNick: string
    login: string
    password: string
    playstyle: string
    isLeader: boolean
  }) => void
}) {
  const [nick, setNick] = useState("")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [playstyle, setPlaystyle] = useState<string>("pvp")
  const [isLeader, setIsLeader] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowe konto</DialogTitle>
          <DialogDescription>
            Osoba bez Discorda wejdzie loginem i hasłem. Nick zobaczą inni na siatce.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="new-nick">Nick w grze</FieldLabel>
            <Input id="new-nick" value={nick} onChange={(event) => setNick(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-login">Login</FieldLabel>
            <Input id="new-login" value={login} onChange={(event) => setLogin(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">Hasło</FieldLabel>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Typ</FieldLabel>
            <ToggleGroup
              value={[playstyle]}
              onValueChange={(value) => {
                if (value[0]) setPlaystyle(value[0])
              }}
              spacing={1}
              size="sm"
            >
              <ToggleGroupItem value="pvp">PVP</ToggleGroupItem>
              <ToggleGroupItem value="pvm">PVM</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field orientation="horizontal">
            <Switch
              checked={isLeader}
              onCheckedChange={setIsLeader}
              id="new-admin"
            />
            <FieldLabel htmlFor="new-admin" className="font-normal">
              Admin
            </FieldLabel>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              onCreate({ gameNick: nick, login, password, playstyle, isLeader })
            }
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Utwórz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({
  user,
  pending,
  onOpenChange,
  onSave,
}: {
  user: Row | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: { userId: string; login?: string; password: string }) => void
}) {
  const [login, setLogin] = useState(user?.login ?? "")
  const [password, setPassword] = useState("")

  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (open && user) {
          setLogin(user.login ?? "")
          setPassword("")
        }
        onOpenChange(open)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hasło · {user?.gameNick}</DialogTitle>
          <DialogDescription>Nowe hasło nadpisze poprzednie. Login możesz uzupełnić.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reset-login">Login</FieldLabel>
            <Input
              id="reset-login"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reset-password">Hasło</FieldLabel>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            disabled={pending || !user}
            onClick={() => {
              if (!user) return
              onSave({ userId: user.id, login, password })
            }}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
