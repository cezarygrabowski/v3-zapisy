"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createCharacterReport,
  deleteCharacterReport,
  deleteReportImage,
  uploadReportImage,
  type ReportInput,
} from "@/lib/actions/progress"
import type { CharacterReport } from "@/lib/progress"
import { CLASS_SKILLS, EQ_GROUPS, SKILL_LEVELS, eqLines, parseEntries, skillLines } from "@/lib/progress-fields"
import { compress } from "@/components/calendar/event-images"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

// Matches the house Input; color-scheme keeps the native option popup readable in dark mode.
const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:light] dark:[color-scheme:dark] dark:bg-input/30"

const textareaClass =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

/** Uploads one by one; returns how many failed. */
async function uploadAll(reportId: string, kind: string, files: File[]) {
  let failed = 0
  for (const file of files) {
    const formData = new FormData()
    formData.set("kind", kind)
    try {
      formData.set("file", await compress(file))
    } catch {
      formData.set("file", file) // not decodable here; the server validates the type
    }
    const result = await uploadReportImage(reportId, formData)
    if (!result.ok) {
      failed++
      toast.error(result.error)
    }
  }
  return failed
}

const imagesOf = (files: FileList | undefined) => Array.from(files ?? []).filter((f) => f.type.startsWith("image/"))

/** A box that takes screenshots from the clipboard: click it and press ⌘V, or use the button. */
function PasteZone({
  onFiles,
  busy,
  children,
}: {
  onFiles: (files: File[]) => void
  busy?: boolean
  children?: React.ReactNode
}) {
  async function fromClipboard() {
    try {
      const files: File[] = []
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"))
        if (type) files.push(new File([await item.getType(type)], "schowek.png", { type }))
      }
      if (files.length) onFiles(files)
      else toast.error("W schowku nie ma obrazka.")
    } catch {
      toast.error("Nie udało się odczytać schowka — kliknij w ramkę i wciśnij ⌘V / Ctrl+V.")
    }
  }

  return (
    <div
      tabIndex={0}
      aria-label="Pole na screenshoty: kliknij i wklej ⌘V / Ctrl+V"
      onPaste={(e) => {
        const files = imagesOf(e.clipboardData?.files)
        if (!files.length || busy) return
        e.preventDefault()
        onFiles(files)
      }}
      className="flex flex-col gap-2 rounded-lg border border-dashed p-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {busy ? (
          <span className="flex items-center gap-1.5">
            <Spinner /> Wysyłanie…
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => void fromClipboard()}>
            📋 Wklej screenshot
          </Button>
        )}
        <span>
          albo kliknij w ramkę i <kbd className="font-mono">⌘V</kbd> / <kbd className="font-mono">Ctrl+V</kbd>
        </span>
      </div>
      {children}
    </div>
  )
}

function Thumbs({ items, onRemove }: { items: { key: string; src: string }[]; onRemove?: (key: string) => void }) {
  if (!items.length) return null
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="relative overflow-hidden rounded-md border bg-muted/30">
          <a href={item.src} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob / auth-protected API image, no optimizer needed */}
            <img src={item.src} alt="Screenshot" loading="lazy" className="aspect-video w-full object-cover" />
          </a>
          {onRemove ? (
            <button
              type="button"
              className="absolute top-1 right-1 cursor-pointer rounded bg-background/80 px-1.5 text-xs hover:text-destructive"
              onClick={() => onRemove(item.key)}
              aria-label="Usuń screenshot"
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** Prefilled from the last report, so the player only edits what changed. */
function prefill(latest?: CharacterReport): ReportInput {
  return {
    level: latest?.level?.toString() ?? "",
    horseLevel: latest?.horseLevel?.toString() ?? "",
    characterClass: latest?.characterClass ?? "",
    biolog: latest?.biolog ?? "",
    skills: latest?.skills ?? "",
    equipment: eqLines(latest?.equipment ?? ""),
    notes: "",
  }
}

type Shot = { key: string; file: File; url: string }

export function NewReportDialog({
  characters,
  defaultCharacterId,
}: {
  characters: { id: string; name: string; latest?: CharacterReport }[]
  defaultCharacterId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [shots, setShots] = useState<Record<string, Shot[]>>({})
  const [characterId, setCharacterId] = useState(defaultCharacterId)
  const latest = characters.find((c) => c.id === characterId)?.latest
  const [form, setForm] = useState(() => prefill(latest))
  const set = (key: keyof ReportInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))
  const skillLevels = new Map(parseEntries(form.skills).map((e) => [e.name.toLowerCase(), e.value]))
  const eqValues = new Map(parseEntries(form.equipment).map((e) => [e.name.toLowerCase(), e.value]))

  function pickCharacter(id: string) {
    setCharacterId(id)
    setForm(prefill(characters.find((c) => c.id === id)?.latest))
  }

  function clearShots() {
    Object.values(shots)
      .flat()
      .forEach((s) => URL.revokeObjectURL(s.url))
    setShots({})
  }

  function addShots(kind: string, files: File[]) {
    const added = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }))
    setShots((s) => ({ ...s, [kind]: [...(s[kind] ?? []), ...added] }))
  }

  function removeShot(kind: string, key: string) {
    shots[kind]?.filter((shot) => shot.key === key).forEach((shot) => URL.revokeObjectURL(shot.url))
    setShots((s) => ({
      ...s,
      [kind]: (s[kind] ?? []).filter((shot) => shot.key !== key),
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    const result = await createCharacterReport(characterId, form)
    if (!result.ok) {
      setPending(false)
      toast.error(result.error)
      return
    }
    for (const [kind, list] of Object.entries(shots)) {
      await uploadAll(
        result.data,
        kind,
        list.map((s) => s.file),
      )
    }
    toast.success("Zapisano raport.")
    setPending(false)
    setOpen(false)
    clearShots()
    router.push(`/postep?postac=${characterId}`)
    router.refresh()
  }

  const pendingShots = (kind: string) => (
    <PasteZone onFiles={(files) => addShots(kind, files)}>
      <Thumbs
        items={(shots[kind] ?? []).map((s) => ({ key: s.key, src: s.url }))}
        onRemove={(key) => removeShot(kind, key)}
      />
    </PasteZone>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) pickCharacter(defaultCharacterId)
        else clearShots()
        setOpen(next)
      }}
    >
      <DialogTrigger render={<Button size="sm">➕ Nowy raport</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nowy raport: {characters.find((c) => c.id === characterId)?.name}</DialogTitle>
          <DialogDescription>
            {latest
              ? "Wpisaliśmy dane z ostatniego raportu — zmień tylko to, co się zmieniło."
              : "Pierwszy raport tej postaci — uzupełnij wszystkie pola. Umiejętności pojawią się po wybraniu klasy."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {characters.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-character">Postać</Label>
              <Select
                items={characters.map((c) => ({ value: c.id, label: c.name }))}
                value={characterId}
                onValueChange={(value) => value && pickCharacter(value)}
              >
                <SelectTrigger id="r-character" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {characters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-level">Poziom</Label>
              <Input id="r-level" required inputMode="numeric" value={form.level} onChange={set("level")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-horse">Poziom konia</Label>
              <select
                id="r-horse"
                required
                className={selectClass}
                value={form.horseLevel}
                onChange={set("horseLevel")}
              >
                <option value="">—</option>
                {/* ElderMT2 horses go up to level 30; 0 = no horse yet. */}
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "brak" : i}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-class">Klasa</Label>
              <select
                id="r-class"
                required
                className={selectClass}
                value={form.characterClass in CLASS_SKILLS ? form.characterClass : ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    characterClass: e.target.value,
                    skills: skillLines(e.target.value, f.skills),
                  }))
                }
              >
                <option value="">Wybierz klasę…</option>
                {Object.keys(CLASS_SKILLS).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-bio">Biolog (etap, ile do końca)</Label>
              <Input
                id="r-bio"
                required
                value={form.biolog}
                onChange={set("biolog")}
                placeholder="np. Etap 8, 3 do końca"
              />
            </div>
          </div>

          {CLASS_SKILLS[form.characterClass] ? (
            <fieldset className="flex flex-col gap-2 rounded-xl border p-3">
              <legend className="px-1 text-sm font-medium">Umiejętności</legend>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {CLASS_SKILLS[form.characterClass].map((name) => (
                  <label key={name} className="flex items-center justify-between gap-2 text-sm">
                    {name}
                    <span className="flex shrink-0 items-center gap-1">
                      <select
                        required
                        className={cn(selectClass, "w-24")}
                        value={skillLevels.get(name.toLowerCase()) ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            skills: skillLines(f.characterClass, f.skills, {
                              name,
                              value: e.target.value,
                            }),
                          }))
                        }
                      >
                        <option value="">—</option>
                        {SKILL_LEVELS.map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                      {/* same empty unit slot as the EQ rows, so every control ends at the same edge */}
                      <span className="w-3" />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {EQ_GROUPS.map((group) => (
            <fieldset key={group.title} className="flex flex-col gap-3 rounded-xl border p-3">
              <legend className="px-1 text-sm font-medium">{group.title}</legend>
              {group.note ? (
                <Alert>
                  <AlertDescription className="font-semibold text-foreground">⚔️ {group.note}</AlertDescription>
                </Alert>
              ) : null}
              {group.sections.map((section) => (
                <div key={section.kind} className="flex flex-col gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    {"hint" in section ? <p className="text-xs text-muted-foreground">{section.hint}</p> : null}
                  </div>
                  <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <label key={field.name} className="flex items-center justify-between gap-2 text-sm">
                        {field.label}
                        <span className="flex shrink-0 items-center gap-1">
                          {"options" in field ? (
                            <select
                              required
                              className={cn(selectClass, "w-24")}
                              value={eqValues.get(field.name.toLowerCase()) ?? ""}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  equipment: eqLines(f.equipment, { name: field.name, value: e.target.value }),
                                }))
                              }
                            >
                              <option value="">—</option>
                              {field.options!.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              required
                              inputMode={field.unit ? "decimal" : "numeric"}
                              className="w-24"
                              value={(eqValues.get(field.name.toLowerCase()) ?? "").replace(/%$/, "")}
                              onChange={(e) => {
                                const value = e.target.value.trim()
                                setForm((f) => ({
                                  ...f,
                                  equipment: eqLines(f.equipment, {
                                    name: field.name,
                                    value: value && value + field.unit,
                                  }),
                                }))
                              }}
                            />
                          )}
                          <span className="w-3 text-muted-foreground">{field.unit}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {pendingShots(section.kind)}
                </div>
              ))}
            </fieldset>
          ))}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-notes">Co się zmieniło w ostatnich 2 tygodniach?</Label>
            <textarea id="r-notes" className={textareaClass} value={form.notes} onChange={set("notes")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Inne screenshoty (opcjonalnie)</span>
            {pendingShots("inne")}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            Zapisz raport
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Saved screenshots of one section; the owner can paste more or delete them. */
export function ReportImages({
  reportId,
  kind,
  imageIds,
  canEdit,
}: {
  reportId: string
  kind: string
  imageIds: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: File[]) {
    setUploading(true)
    const failed = await uploadAll(reportId, kind, files)
    setUploading(false)
    if (failed < files.length) toast.success(`Dodano screenshoty: ${files.length - failed}.`)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć ten screenshot?")) return
    const result = await deleteReportImage(id)
    if (result.ok) router.refresh()
    else toast.error(result.error)
  }

  const thumbs = (
    <Thumbs
      items={imageIds.map((id) => ({
        key: id,
        src: `/api/progress-images/${id}`,
      }))}
      onRemove={canEdit ? (id) => void handleDelete(id) : undefined}
    />
  )
  if (canEdit)
    return (
      <PasteZone onFiles={(files) => void handleFiles(files)} busy={uploading}>
        {thumbs}
      </PasteZone>
    )
  return imageIds.length ? thumbs : <p className="text-xs text-muted-foreground">Brak screenshotów.</p>
}

export function DeleteReportButton({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-xs text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Usunąć ten raport razem ze screenshotami?")) return
        startTransition(async () => {
          const result = await deleteCharacterReport(reportId)
          if (!result.ok) toast.error(result.error)
          router.refresh()
        })
      }}
    >
      Usuń ten raport
    </Button>
  )
}

const listDateFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "short",
  year: "numeric",
})
const STALE_MS = 14 * 24 * 60 * 60 * 1000

export type ListCharacter = {
  id: string
  name: string
  ownerNick: string
  guildName: string | null
  characterClass: string
  level: number | null
  horseLevel: number | null
  lastReportAt: string | null
}

/** Empty bound means no limit; a character without a report has no level and drops out once a bound is set. */
function inRange(value: number | null, from: string, to: string) {
  if (!from && !to) return true
  return value !== null && (!from || value >= Number(from)) && (!to || value <= Number(to))
}

/** Filters run in the browser: the list is already limited to what this user may see. */
export function CharacterList({
  characters,
  selectedId,
  showGuildFilter,
}: {
  characters: ListCharacter[]
  selectedId?: string
  showGuildFilter: boolean
}) {
  const [query, setQuery] = useState("")
  const [guild, setGuild] = useState("")
  const [characterClass, setCharacterClass] = useState("")
  const [report, setReport] = useState("")
  const [now] = useState(() => Date.now())
  const [level, setLevel] = useState({ from: "", to: "" })
  const [horse, setHorse] = useState({ from: "", to: "" })
  const guilds = [...new Set(characters.map((c) => c.guildName ?? ""))].sort()
  const q = query.trim().toLowerCase()
  const visible = characters.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q) || c.ownerNick.toLowerCase().includes(q)) &&
      (!showGuildFilter || !guild || (c.guildName ?? "-") === guild) &&
      (!characterClass || c.characterClass === characterClass) &&
      inRange(c.level, level.from, level.to) &&
      inRange(c.horseLevel, horse.from, horse.to) &&
      (!report ||
        (report === "none" ? !c.lastReportAt : !c.lastReportAt || now - new Date(c.lastReportAt).getTime() > STALE_MS)),
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj postaci lub gracza"
          aria-label="Szukaj postaci lub gracza"
        />
        <div className={cn("grid gap-1.5 lg:grid-cols-1", showGuildFilter ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {showGuildFilter ? (
            <select
              className={selectClass}
              value={guild}
              onChange={(e) => setGuild(e.target.value)}
              aria-label="Gildia"
            >
              <option value="">Gildia: wszystkie</option>
              {guilds.map((g) => (
                <option key={g || "-"} value={g || "-"}>
                  {g || "bez gildii"}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className={selectClass}
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
            aria-label="Klasa"
          >
            <option value="">Klasa: wszystkie</option>
            {Object.keys(CLASS_SKILLS).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={report}
            onChange={(e) => setReport(e.target.value)}
            aria-label="Raport"
          >
            <option value="">Raport: wszystkie</option>
            <option value="stale">Starszy niż 2 tyg. lub brak</option>
            <option value="none">Brak raportu</option>
          </select>
        </div>
        {(
          [
            ["Poziom", level, setLevel, 999],
            ["Poziom konia", horse, setHorse, 30],
          ] as const
        ).map(([label, range, setRange, max]) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-20 shrink-0">{label}</span>
            <Input
              type="number"
              min={0}
              max={max}
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              placeholder="od"
              aria-label={`${label} od`}
            />
            <Input
              type="number"
              min={0}
              max={max}
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              placeholder="do"
              aria-label={`${label} do`}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {visible.length} z {characters.length}
        </p>
      </div>
      <nav aria-label="Postacie" className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto lg:max-h-[65vh]">
        {visible.map((c) => (
          <Link
            key={c.id}
            href={`/postep?postac=${c.id}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted",
              c.id === selectedId && "bg-primary/15 text-primary",
            )}
          >
            <span className="truncate">
              {c.name} <span className="text-xs text-muted-foreground">({c.ownerNick})</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {c.lastReportAt ? listDateFmt.format(new Date(c.lastReportAt)) : "brak"}
            </span>
          </Link>
        ))}
        {characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nikt nie ma jeszcze postaci. Dodaj ją w zakładce Konto.</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Żadna postać nie pasuje do filtrów.</p>
        ) : null}
      </nav>
    </div>
  )
}
