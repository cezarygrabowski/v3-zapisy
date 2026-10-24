import Link from "next/link"
import { CharacterList, DeleteReportButton, NewReportDialog, ReportImages } from "@/components/progress-view"
import { cn } from "@/lib/utils"
import {
  diffEntries,
  latestReports,
  listCharacterReports,
  listProgressCharacters,
  type CharacterReport,
  type EntryDiff,
} from "@/lib/progress"
import { requireUser } from "@/lib/session"
import { EQ_GROUPS, EQ_SECTIONS } from "@/lib/progress-fields"

export const dynamic = "force-dynamic"

const dateFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "numeric",
  month: "short",
  year: "numeric",
})
// Chips show the hour too, so two reports from the same day stay distinguishable.
const chipFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  dateStyle: "medium",
  timeStyle: "short",
})

function href(postac: string, raport?: string, od?: string) {
  const params = new URLSearchParams({ postac })
  if (raport) params.set("raport", raport)
  if (od) params.set("od", od)
  return `/postep?${params}`
}

/** Scalar fields as entries so they render and count like skills / EQ. */
function basics(r: CharacterReport) {
  return [
    `Poziom: ${r.level ?? ""}`,
    `Poziom konia: ${r.horseLevel === 0 ? "brak" : (r.horseLevel ?? "")}`,
    `Klasa: ${r.characterClass}`,
    `Biolog: ${r.biolog}`,
  ].join("\n")
}

function DiffTable({ rows }: { rows: EntryDiff[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Brak wpisów.</p>
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-b border-border/40 last:border-0">
            <td className="py-1 pr-2">{row.name}</td>
            <td className="py-1 text-right">
              {row.status === "changed" || row.status === "new" ? (
                <>
                  <span className="text-muted-foreground">{row.before || "—"} → </span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{row.value || "—"} ▲</span>
                </>
              ) : row.status === "removed" ? (
                <span className="text-muted-foreground line-through">{row.before || "usunięte"}</span>
              ) : (
                <span className="text-muted-foreground">{row.value || "—"}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

const eqNames = new Set(EQ_SECTIONS.flatMap((s) => s.fields.map((f) => f.name.toLowerCase())))

export default async function PostepPage({
  searchParams,
}: {
  searchParams: Promise<{ postac?: string; raport?: string; od?: string }>
}) {
  const user = await requireUser()
  const { postac, raport, od } = await searchParams
  // Already scoped to what this user may see and edit.
  const characters = await listProgressCharacters(user)
  const character =
    characters.find((c) => c.id === postac) ?? characters.find((c) => c.userId === user.id) ?? characters[0]
  const reports = character ? await listCharacterReports(character.id) : []
  const index = Math.max(
    0,
    reports.findIndex((r) => r.id === raport),
  )
  const current = reports[index]
  const older = reports.slice(index + 1)
  // Default comparison: the report right before; ?od= picks any older one for a longer period.
  const base = older.find((r) => r.id === od) ?? older[0]
  const canEdit = !!character
  // The form offers the player's own characters; an admin also gets the one being viewed.
  const ownCharacters = characters.filter((c) => c.userId === user.id || (canEdit && c.id === character?.id))
  const latest = await latestReports(ownCharacters.map((c) => c.id))

  const sections = current
    ? {
        basics: diffEntries(basics(current), base && basics(base)),
        skills: diffEntries(current.skills, base?.skills),
        // Only the known EQ fields; lines from an older EQ format are not shown.
        equipment: diffEntries(current.equipment, base?.equipment).filter((row) => eqNames.has(row.name.toLowerCase())),
      }
    : null
  const changes = sections
    ? Object.values(sections)
        .flat()
        .filter((row) => row.status !== "same").length
    : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold">📈 Postęp postaci</h1>
          <p className="text-sm text-muted-foreground">
            Co jakiś czas (np. co 2 tygodnie) dodaj raport swojej postaci. Na zielono widać, co się zmieniło od
            poprzedniego.
          </p>
        </div>
        {ownCharacters.length ? (
          <NewReportDialog
            characters={ownCharacters.map((c) => ({
              id: c.id,
              name: c.name,
              latest: latest.get(c.id),
            }))}
            defaultCharacterId={canEdit ? character!.id : ownCharacters[0].id}
          />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <CharacterList
          characters={characters.map((c) => ({
            id: c.id,
            name: c.name,
            ownerNick: c.ownerNick,
            guildName: c.guildName,
            characterClass: c.characterClass,
            level: c.level,
            horseLevel: c.horseLevel,
            lastReportAt: c.lastReportAt ? new Date(c.lastReportAt).toISOString() : null,
          }))}
          selectedId={character?.id}
          showGuildFilter={user.isSuperAdmin}
        />

        {character ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-heading text-xl font-semibold">
                {character.name} <span className="text-sm text-muted-foreground">· {character.ownerNick}</span>
              </h2>
            </div>

            {current ? (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="self-center text-xs text-muted-foreground">Raport:</span>
                    {[...reports].reverse().map((r) => (
                      <Link
                        key={r.id}
                        href={href(character.id, r.id)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs hover:bg-muted",
                          r.id === current.id && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                        )}
                      >
                        {chipFmt.format(r.createdAt)}
                      </Link>
                    ))}
                  </div>
                  {older.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="self-center text-xs text-muted-foreground">Porównaj z:</span>
                      {older.map((r) => (
                        <Link
                          key={r.id}
                          href={href(character.id, current.id, r.id)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs hover:bg-muted",
                            r.id === base?.id && "border-primary text-primary",
                          )}
                        >
                          {chipFmt.format(r.createdAt)}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>

                <p className="text-sm">
                  {base ? (
                    <span className="rounded-full bg-green-600/15 px-2.5 py-1 text-green-700 dark:text-green-400">
                      ▲ {changes}{" "}
                      {changes === 1
                        ? "zmiana"
                        : [2, 3, 4].includes(changes % 10) && ![12, 13, 14].includes(changes % 100)
                          ? "zmiany"
                          : "zmian"}{" "}
                      od {dateFmt.format(base.createdAt)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Pierwszy raport — nie ma jeszcze z czym porównać.</span>
                  )}
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <Section title="Postać">
                    <DiffTable rows={sections!.basics} />
                  </Section>
                  <Section title="Umiejętności">
                    <DiffTable rows={sections!.skills} />
                  </Section>
                </div>

                {EQ_GROUPS.map((group) => (
                  <Section key={group.title} title={group.title}>
                    {group.note ? <p className="text-sm font-semibold">⚔️ {group.note}</p> : null}
                    <div
                      className={cn("grid gap-6", group.sections.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}
                    >
                      {group.sections.map((section) => (
                        <div key={section.kind} className="flex flex-col gap-2">
                          <div>
                            <h3 className="text-sm font-semibold">{section.title}</h3>
                            {"hint" in section ? <p className="text-xs text-muted-foreground">{section.hint}</p> : null}
                          </div>
                          <DiffTable
                            rows={section.fields.flatMap((f) =>
                              sections!.equipment
                                .filter((row) => row.name.toLowerCase() === f.name.toLowerCase())
                                .map((row) => ({ ...row, name: f.label })),
                            )}
                          />
                          {/* mt-auto keeps the screenshot boxes level across columns */}
                          <div className="mt-auto pt-1">
                            <ReportImages
                              reportId={current.id}
                              kind={section.kind}
                              imageIds={current.images.filter((i) => i.kind === section.kind).map((i) => i.id)}
                              canEdit={canEdit}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                ))}

                <div className="grid gap-4 md:grid-cols-2">
                  <Section title="Co się zmieniło w ostatnich 2 tygodniach?">
                    <p className="text-sm whitespace-pre-wrap">{current.notes || "—"}</p>
                  </Section>
                  <Section title="Inne screenshoty">
                    <ReportImages
                      reportId={current.id}
                      kind="inne"
                      imageIds={current.images.filter((i) => i.kind === "inne").map((i) => i.id)}
                      canEdit={canEdit}
                    />
                  </Section>
                </div>

                {canEdit ? (
                  <div>
                    <DeleteReportButton reportId={current.id} />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Ta postać nie ma jeszcze raportu.
                {canEdit ? " Dodaj pierwszy przyciskiem „Nowy raport” na górze." : ""}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
