"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createUser,
  setLeader,
  setPlaystyle,
  setUserPassword,
  setUserRoles,
  setUserVerified,
  toggleUserRole,
} from "@/lib/actions/admin"
import { startImpersonation } from "@/lib/actions/impersonation"
import { PREDEFINED_ROLES } from "@/lib/db/schema"
import { getUserRoles } from "@/lib/permissions"
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
  isVerified: boolean
  roles: string
}

export function AdminUsers({
  users,
  currentUserId,
}: {
  users: Row[]
  currentUserId?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [passwordUser, setPasswordUser] = useState<Row | null>(null)
  const [rolesUser, setRolesUser] = useState<Row | null>(null)

  function run(
    action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) toast.error(result.error)
      else toast.success(result.message ?? "Zapisano")
    })
  }

  function handleImpersonate(targetUserId: string) {
    startTransition(async () => {
      const res = await startImpersonation(targetUserId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      router.push("/panel")
      router.refresh()
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
            <TableHead>Weryfikacja</TableHead>
            <TableHead>Role / Tagi</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const userRoles = getUserRoles({ roles: user.roles })
            const isV3 = userRoles.includes("V3")

            return (
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
                  {user.isLeader ? (
                    <Badge variant="outline" className="text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      Admin (auto)
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.isVerified}
                        disabled={pending}
                        onCheckedChange={(checked) => run(() => setUserVerified(user.id, checked))}
                        aria-label={`Zweryfikuj ${user.gameNick}`}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          user.isVerified
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400 animate-pulse"
                        }`}
                      >
                        {user.isVerified ? "Zweryfikowany" : "Oczekuje"}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="xs"
                      variant={isV3 ? "default" : "outline"}
                      className={`text-[11px] h-6 px-2 font-bold cursor-pointer transition-all ${
                        isV3
                          ? "bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:border-cyan-500/50"
                      }`}
                      disabled={pending}
                      onClick={() => run(() => toggleUserRole(user.id, "V3"))}
                      title={isV3 ? "Kliknij, aby odebrać rolę V3" : "Kliknij, aby nadać rolę V3"}
                    >
                      {isV3 ? "✓ V3" : "+ V3"}
                    </Button>

                    {userRoles
                      .filter((r) => r !== "V3")
                      .map((role) => (
                        <Badge key={role} variant="secondary" className="text-[10px] h-5 px-1.5">
                          {role}
                        </Badge>
                      ))}

                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-[11px] h-6 px-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setRolesUser(user)}
                      title="Zarządzaj rolami i tagami"
                    >
                      🏷️ Role
                    </Button>
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
                  <div className="flex items-center justify-end gap-1.5">
                    {user.id !== currentUserId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                        onClick={() => handleImpersonate(user.id)}
                        disabled={pending}
                        title={`Wciel się w gracza ${user.gameNick}`}
                      >
                        <span>🎭</span>
                        <span>Wciel się</span>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="h-8 text-xs cursor-pointer" onClick={() => setPasswordUser(user)}>
                      Hasło
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
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

      <ManageRolesDialog
        key={rolesUser?.id ?? "closed-roles"}
        user={rolesUser}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setRolesUser(null)
        }}
        onSave={(roles) => {
          if (!rolesUser) return
          run(async () => {
            const result = await setUserRoles(rolesUser.id, roles)
            if (result.ok) setRolesUser(null)
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

function ManageRolesDialog({
  user,
  pending,
  onOpenChange,
  onSave,
}: {
  user: Row | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSave: (roles: string[]) => void
}) {
  const initialRoles = user ? getUserRoles({ roles: user.roles }) : []
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialRoles)
  const [customTag, setCustomTag] = useState("")

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  function handleAddCustomTag() {
    const clean = customTag.trim()
    if (!clean) return
    if (!selectedRoles.includes(clean)) {
      setSelectedRoles((prev) => [...prev, clean])
    }
    setCustomTag("")
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zarządzaj rolami i tagami · {user?.gameNick}</DialogTitle>
          <DialogDescription>
            Przypisz uprawnienia i grupy. Tylko osoby z rolą <strong>V3</strong> mają dostęp do szczegółów i zapisów V3.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Szybkie role
            </span>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_ROLES.map((role) => {
                const active = selectedRoles.includes(role)
                return (
                  <Button
                    key={role}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={`text-xs h-7 px-2.5 font-semibold cursor-pointer ${
                      role === "V3" && active
                        ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                        : ""
                    }`}
                    onClick={() => toggleRole(role)}
                  >
                    {active ? `✓ ${role}` : `+ ${role}`}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Własny tag / rola
            </span>
            <div className="flex items-center gap-2">
              <Input
                placeholder="np. Lider grupy, Droper"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddCustomTag()
                  }
                }}
                className="text-xs h-8"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="text-xs h-8 px-3 cursor-pointer"
                onClick={handleAddCustomTag}
              >
                Dodaj
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Aktualnie wybrane ({selectedRoles.length})
            </span>
            {selectedRoles.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Brak przypisanych ról.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-muted/20">
                {selectedRoles.map((role) => (
                  <Badge
                    key={role}
                    className={`text-xs gap-1 pl-2 pr-1 py-0.5 ${
                      role === "V3"
                        ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <span>{role}</span>
                    <button
                      type="button"
                      onClick={() => toggleRole(role)}
                      className="ml-1 text-[10px] hover:text-destructive opacity-75 hover:opacity-100 cursor-pointer"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            size="sm"
            disabled={pending || !user}
            onClick={() => onSave(selectedRoles)}
            className="cursor-pointer"
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Zapisz role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

