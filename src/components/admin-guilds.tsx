"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createGuild, deleteGuild, setCharacterGuild } from "@/lib/actions/guilds"
import type { ActionResult } from "@/lib/actions/result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const NONE = "none"

export function AdminGuilds({
  guilds,
  characters,
}: {
  guilds: { id: string; name: string; characters: number }[]
  characters: { id: string; name: string; ownerNick: string; guildId: string | null }[]
}) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const items = [{ value: NONE, label: "— bez gildii —" }, ...guilds.map((g) => ({ value: g.id, label: g.name }))]

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) return void toast.error(result.error)
      toast.success(result.message ?? "Zapisano")
      onOk?.()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Gildie</h2>
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(
              () => createGuild(name),
              () => setName(""),
            )
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa nowej gildii, np. OB"
            aria-label="Nazwa nowej gildii"
          />
          <Button type="submit" disabled={pending || !name.trim()}>
            Dodaj
          </Button>
        </form>
        {guilds.length ? (
          <ul className="flex flex-wrap gap-2">
            {guilds.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                <span className="font-semibold">{g.name}</span>
                <span className="text-xs text-muted-foreground">{g.characters} post.</span>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  aria-label={`Usuń gildię ${g.name}`}
                  onClick={() => {
                    if (
                      confirm(
                        `Usunąć gildię ${g.name}? Jej postacie zostaną bez gildii, a jej admini stracą do nich wgląd.`,
                      )
                    )
                      run(() => deleteGuild(g.id))
                  }}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nie ma jeszcze żadnej gildii.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Postacie</h2>
        <p className="text-sm text-muted-foreground">
          Admin gildii widzi w zakładce Postęp tylko postacie swojej gildii. Postać bez gildii widzi tylko jej
          właściciel i Ty.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Postać</TableHead>
              <TableHead>Gracz</TableHead>
              <TableHead>Gildia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {characters.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.ownerNick}</TableCell>
                <TableCell>
                  <Select
                    items={items}
                    value={c.guildId ?? NONE}
                    disabled={pending}
                    onValueChange={(value) =>
                      value && run(() => setCharacterGuild(c.id, value === NONE ? null : value))
                    }
                  >
                    <SelectTrigger className="w-44" aria-label={`Gildia postaci ${c.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
