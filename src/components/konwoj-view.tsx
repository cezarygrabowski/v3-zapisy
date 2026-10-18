"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  addKonwojPrice,
  createKonwojGroup,
  deleteKonwojGroup,
  deleteKonwojPrice,
  setKonwojGroupMember,
  setKonwojGroupTreasurer,
  setKonwojWeekState,
  toggleKonwojPayout,
  updateKonwojPrice,
} from "@/lib/actions/konwoj"
import type { ActionResult } from "@/lib/actions/result"
import { formatDatePl } from "@/lib/dates"
import type { KonwojGroup, KonwojPrice, KonwojRun, KonwojShare } from "@/lib/konwoj"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Week = {
  weekStart: string
  collectorName: string | null
  poolKk: number
  shopYangKk: number
  itemsValueKk: number
  runs: KonwojRun[]
  shares: KonwojShare[]
  totalRuns: number
  leftoverKk: number
}

function formatKk(value: number): string {
  return `${value.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} kk`
}

function parseKkInput(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".")
  return normalized === "" ? null : Number(normalized)
}

function priceText(value: number | null): string {
  return value === null ? "—" : formatKk(value)
}

function useAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const res = await action()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.message) toast.success(res.message)
      onOk?.()
      router.refresh()
    })
  }
  return { pending, run }
}

export function KonwojView({
  groups,
  group,
  week,
  weekLabel,
  prevWeek,
  nextWeek,
  isCurrentWeek,
  canManage,
  currentUserId,
  prices,
}: {
  groups: { id: string; name: string }[]
  group: KonwojGroup
  week: Week
  prices: KonwojPrice[]
  weekLabel: string
  prevWeek: string
  nextWeek: string
  isCurrentWeek: boolean
  canManage: boolean
  currentUserId: string
}) {
  const href = (weekStart: string, groupId = group.id) => `/konwoj?druzyna=${groupId}&tydzien=${weekStart}`
  const treasurers = group.members.filter((m) => m.isTreasurer).map((m) => m.gameNick)
  const ctx = { groupId: group.id, weekStart: week.weekStart, canManage }

  return (
    <div className="flex flex-col gap-6">
      {groups.length > 1 ? (
        <nav className="flex flex-wrap gap-1.5" aria-label="Drużyny">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={href(week.weekStart, g.id)}
              aria-current={g.id === group.id ? "page" : undefined}
              className={buttonVariants({
                variant: g.id === group.id ? "default" : "outline",
                size: "sm",
              })}
            >
              {g.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Link href={href(prevWeek)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ← Poprzedni
          </Link>
          <span className="min-w-36 text-center font-heading text-sm font-semibold">
            {weekLabel}
            {isCurrentWeek ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(ten tydzień)</span>
            ) : null}
          </span>
          <Link href={href(nextWeek)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Następny →
          </Link>
        </div>
        <span className="text-sm text-muted-foreground">
          Drużyna <strong className="text-foreground">{group.name}</strong> ·{" "}
          {treasurers.length > 1 ? "skarbnicy" : "skarbnik"}:{" "}
          <strong className="text-foreground">{treasurers.join(", ") || "brak"}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SettlementCard key={`${group.id}-${week.weekStart}`} week={week} ctx={ctx} currentUserId={currentUserId} />
        <RunsCard week={week} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <StateCard key={`${group.id}-${week.weekStart}`} week={week} ctx={ctx} />
        <PricesCard key={group.id} prices={prices} ctx={ctx} />
      </div>
    </div>
  )
}

type Ctx = { groupId: string; weekStart: string; canManage: boolean }

function SettlementCard({ week, ctx, currentUserId }: { week: Week; ctx: Ctx; currentUserId: string }) {
  const { pending, run } = useAction()
  const active = week.shares.filter((s) => s.runs > 0)
  const paidCount = active.filter((s) => s.paid).length

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>💰 Rozliczenie tygodnia</CardTitle>
        <CardDescription>Do podziału: czyste yang na postaci + szacowana wartość itemów na shopie.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Czyste yang" value={formatKk(week.shopYangKk)} />
          <Stat label="Itemy na shopie (szac.)" value={formatKk(week.itemsValueKk)} />
          <Stat label="Razem do podziału" value={formatKk(week.poolKk)} highlight />
          <Stat
            label="Za 1 wejście"
            value={week.totalRuns ? formatKk(Math.floor(week.poolKk / week.totalRuns)) : "—"}
          />
        </div>

        {week.shares.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Drużyna nie ma jeszcze członków.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gracz</TableHead>
                <TableHead className="text-right">Wejścia</TableHead>
                <TableHead className="text-right">Udział</TableHead>
                <TableHead className="text-right">Szacowana dola</TableHead>
                <TableHead className="text-right">
                  Wypłata {active.length ? `(${paidCount}/${active.length})` : ""}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {week.shares.map((s) => (
                <TableRow
                  key={s.userId}
                  className={cn(s.userId === currentUserId && "bg-primary/5", s.runs === 0 && "text-muted-foreground")}
                >
                  <TableCell className="font-medium">
                    {s.gameNick}
                    {s.userId === currentUserId ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">(Ty)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-mono">{s.runs}</TableCell>
                  <TableCell className="text-right font-mono">{s.percentage.toLocaleString("pl-PL")}%</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatKk(s.shareKk)}</TableCell>
                  <TableCell className="text-right">
                    {s.runs === 0 ? (
                      <span className="text-xs">—</span>
                    ) : ctx.canManage ? (
                      <Button
                        size="xs"
                        variant={s.paid ? "secondary" : "outline"}
                        disabled={pending}
                        aria-pressed={s.paid}
                        onClick={() => run(() => toggleKonwojPayout(ctx.groupId, ctx.weekStart, s.userId))}
                      >
                        {s.paid ? "✓ Wypłacone" : "Oznacz wypłatę"}
                      </Button>
                    ) : (
                      <Badge variant={s.paid ? "secondary" : "outline"}>{s.paid ? "✓ Wypłacone" : "Do wypłaty"}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {week.leftoverKk > 0 && week.totalRuns > 0 ? (
          <p className="text-xs text-muted-foreground">
            Reszta z zaokrągleń zostaje w drużynie: {formatKk(week.leftoverKk)}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight ? "border-primary/40 bg-primary/10" : "bg-muted/20")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-base font-semibold">{value}</div>
    </div>
  )
}

function RunsCard({ week }: { week: Week }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🗓️ Wejścia</CardTitle>
        <CardDescription>
          Wejścia drużyny z kalendarza. Obecność zaznacza skarbnik lub admin w oknie wydarzenia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {week.runs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Brak zaplanowanych wejść.{" "}
            <Link href={`/kalendarz?tydzien=${week.weekStart}`} className="underline">
              Dodaj w kalendarzu
            </Link>
          </p>
        ) : (
          week.runs.map((r) => (
            <Link
              key={r.id}
              href={`/kalendarz?tydzien=${week.weekStart}&wydarzenie=${r.id}`}
              className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted/40"
            >
              <span className="flex flex-col">
                <span className="font-medium">{formatDatePl(r.date)}</span>
                <span className="text-xs text-muted-foreground">
                  {r.startTime} · {r.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className="font-mono" title="Koni 30 lvl / zapisanych">
                  🐎 {r.horses}/{r.signups}
                </Badge>
                <Badge variant="secondary" className="font-mono" title="Obecnych / zapisanych">
                  {r.attended}/{r.signups}
                </Badge>
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function StateCard({ week, ctx }: { week: Week; ctx: Ctx }) {
  const { pending, run } = useAction()
  const [form, setForm] = useState({
    collector: week.collectorName ?? "",
    yang: week.shopYangKk ? String(week.shopYangKk) : "",
    items: week.itemsValueKk ? String(week.itemsValueKk) : "",
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    run(() =>
      setKonwojWeekState(ctx.groupId, ctx.weekStart, {
        collectorName: form.collector,
        yangKk: parseKkInput(form.yang) ?? 0,
        itemsValueKk: parseKkInput(form.items) ?? 0,
      })
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>📦 Aktualny stan</CardTitle>
        <CardDescription>Stan drużyny w wybranym tygodniu.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Stat label="Drop zbieramy na postać" value={week.collectorName ?? "— nie ustawiono —"} highlight />
          </div>
          <Stat label="Czyste yang na postaci" value={formatKk(week.shopYangKk)} />
          <Stat label="Do wyciągnięcia z itemów" value={formatKk(week.itemsValueKk)} />
        </div>
        {ctx.canManage ? (
          <form onSubmit={handleSave} className="flex flex-col gap-2 rounded-lg border bg-muted/10 p-3">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Postać zbierająca drop
              <Input
                value={form.collector}
                onChange={(e) => setForm({ ...form, collector: e.target.value })}
                placeholder="np. Skarbnik1"
                maxLength={40}
                className="h-8"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Czyste yang na postaci (kk)
              <Input
                inputMode="decimal"
                value={form.yang}
                onChange={(e) => setForm({ ...form, yang: e.target.value })}
                placeholder="np. 1500"
                className="h-8"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Szacowana wartość itemów na shopie (kk)
              <Input
                inputMode="decimal"
                value={form.items}
                onChange={(e) => setForm({ ...form, items: e.target.value })}
                placeholder="np. 800"
                className="h-8"
              />
            </label>
            <Button type="submit" size="sm" disabled={pending} className="self-start">
              Zapisz stan
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PricesCard({ prices, ctx }: { prices: KonwojPrice[]; ctx: Ctx }) {
  const { pending, run } = useAction()
  const [draft, setDraft] = useState({ name: "", market: "", guild: "" })
  const [filter, setFilter] = useState("")
  const query = filter.trim().toLocaleLowerCase("pl")
  const visible = prices.filter((p) => p.name.toLocaleLowerCase("pl").includes(query))

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    run(
      () =>
        addKonwojPrice(ctx.groupId, draft.name, {
          marketPriceKk: parseKkInput(draft.market),
          guildPriceKk: parseKkInput(draft.guild),
        }),
      () => setDraft({ name: "", market: "", guild: "" })
    )
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>🏷️ Wycena przedmiotów</CardTitle>
        <CardDescription>Cennik dropu z Konwoju dla drużyny. Ceny bez podatku.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ctx.canManage ? (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/10 p-3">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Przedmiot
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="np. Broszura Szermierki"
                className="h-8 w-56"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Rynek (kk)
              <Input
                inputMode="decimal"
                value={draft.market}
                onChange={(e) => setDraft({ ...draft, market: e.target.value })}
                className="h-8 w-24"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Gildia (kk)
              <Input
                inputMode="decimal"
                value={draft.guild}
                onChange={(e) => setDraft({ ...draft, guild: e.target.value })}
                className="h-8 w-24"
              />
            </label>
            <Button type="submit" size="sm" disabled={pending || !draft.name.trim()}>
              + Dodaj
            </Button>
          </form>
        ) : null}

        {prices.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Brak wycenionych przedmiotów.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="🔍 Szukaj przedmiotu…"
              aria-label="Filtruj przedmioty"
              className="h-8 w-full sm:w-64"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Przedmiot</TableHead>
                  <TableHead className="text-right">Cena rynkowa (bez podatku)</TableHead>
                  <TableHead className="text-right">Cena gildyjna (bez podatku)</TableHead>
                  {ctx.canManage ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <PriceRow key={item.id} item={item} canManage={ctx.canManage} pending={pending} run={run} />
                ))}
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={ctx.canManage ? 4 : 3} className="text-center text-muted-foreground">
                      Brak przedmiotów pasujących do „{filter.trim()}”.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PriceRow({
  item,
  canManage,
  pending,
  run,
}: {
  item: KonwojPrice
  canManage: boolean
  pending: boolean
  run: ReturnType<typeof useAction>["run"]
}) {
  const [editing, setEditing] = useState(false)
  const initial = {
    market: item.marketPriceKk === null ? "" : String(item.marketPriceKk),
    guild: item.guildPriceKk === null ? "" : String(item.guildPriceKk),
  }
  const [form, setForm] = useState(initial)
  // Inputs live in other cells, so they join the row's form via the `form` attribute (Enter submits).
  const formId = `konwoj-price-${item.id}`

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    run(
      () =>
        updateKonwojPrice(item.id, {
          marketPriceKk: parseKkInput(form.market),
          guildPriceKk: parseKkInput(form.guild),
        }),
      () => setEditing(false)
    )
  }

  const input = (key: keyof typeof form, label: string) => (
    <Input
      form={formId}
      inputMode="decimal"
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      aria-label={`${label}: ${item.name}`}
      className="ml-auto h-7 w-24 text-right"
    />
  )

  return (
    <TableRow>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell className="text-right font-mono">
        {editing ? input("market", "Cena rynkowa") : priceText(item.marketPriceKk)}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        {editing ? input("guild", "Cena gildyjna") : priceText(item.guildPriceKk)}
      </TableCell>
      {canManage ? (
        <TableCell className="text-right">
          {editing ? (
            <form id={formId} onSubmit={handleSave} className="flex items-center justify-end gap-1.5">
              <Button type="submit" size="xs" disabled={pending}>
                Zapisz
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => {
                  setForm(initial)
                  setEditing(false)
                }}
              >
                Anuluj
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
                Edytuj
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={pending}
                aria-label={`Usuń ${item.name}`}
                onClick={() => {
                  if (confirm(`Usunąć „${item.name}” z wyceny?`)) run(() => deleteKonwojPrice(item.id))
                }}
              >
                ✕
              </Button>
            </div>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  )
}

export function KonwojGroupsAdmin({
  groups,
  users,
}: {
  groups: KonwojGroup[]
  users: { id: string; gameNick: string }[]
}) {
  const { pending, run } = useAction()
  const [name, setName] = useState("")
  const groupOf = new Map(groups.flatMap((g) => g.members.map((m) => [m.userId, g.name] as const)))

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            👥 Zarządzaj drużynami
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>👥 Drużyny Konwoju</DialogTitle>
          <DialogDescription>
            Gracz należy do jednej drużyny. Skarbnicy (💰) ustawiają yang, przedmioty, wypłaty i obecność swojej
            drużyny. Kliknij 💰 przy graczu, aby nadać lub odebrać rolę.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            run(
              () => createKonwojGroup(name),
              () => setName("")
            )
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col gap-1 text-xs font-medium">
            Nowa drużyna
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Drużyna A"
              className="h-8 w-48"
            />
          </label>
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            + Utwórz
          </Button>
        </form>

        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading font-semibold">{g.name}</span>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Usunąć drużynę „${g.name}” razem z jej stanem i rozliczeniami?`)) {
                      run(() => deleteKonwojGroup(g.id))
                    }
                  }}
                >
                  Usuń drużynę
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {g.members.length === 0 ? <span className="text-xs text-muted-foreground">Brak członków.</span> : null}
                {g.members.map((m) => (
                  <Badge
                    key={m.userId}
                    variant={m.isTreasurer ? "default" : "secondary"}
                    className="gap-0.5 pr-0.5 pl-0.5"
                  >
                    <button
                      type="button"
                      className={cn("rounded px-1", !m.isTreasurer && "opacity-40 hover:opacity-100")}
                      aria-pressed={m.isTreasurer}
                      aria-label={`Skarbnik: ${m.gameNick}`}
                      title={m.isTreasurer ? "Odbierz rolę skarbnika" : "Nadaj rolę skarbnika"}
                      disabled={pending}
                      onClick={() => run(() => setKonwojGroupTreasurer(g.id, m.userId, !m.isTreasurer))}
                    >
                      💰
                    </button>
                    {m.gameNick}
                    <button
                      type="button"
                      className="rounded px-1 opacity-60 hover:text-destructive hover:opacity-100"
                      aria-label={`Usuń ${m.gameNick} z drużyny ${g.name}`}
                      disabled={pending}
                      onClick={() => run(() => setKonwojGroupMember(m.userId, null))}
                    >
                      ✕
                    </button>
                  </Badge>
                ))}
              </div>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Dodaj gracza
                <NativeSelect
                  value=""
                  disabled={pending}
                  onChange={(userId) => userId && run(() => setKonwojGroupMember(userId, g.id))}
                >
                  <option value="">Wybierz gracza…</option>
                  {users
                    .filter((u) => !g.members.some((m) => m.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.gameNick}
                        {groupOf.has(u.id) ? ` (przenieś z: ${groupOf.get(u.id)})` : ""}
                      </option>
                    ))}
                </NativeSelect>
              </label>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NativeSelect({
  value,
  disabled,
  onChange,
  children,
}: {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm font-normal text-foreground shadow-xs [color-scheme:light] dark:[color-scheme:dark] dark:bg-zinc-900 dark:text-zinc-100"
    >
      {children}
    </select>
  )
}
