"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { type Playstyle } from "@/lib/constants"
import { updateProfile } from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function ProfileForm({
  gameNick,
  playstyle,
}: {
  gameNick: string
  playstyle: Playstyle | null
}) {
  const router = useRouter()
  const [nick, setNick] = useState(gameNick)
  const [style, setStyle] = useState<Playstyle | null>(playstyle)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex max-w-md flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await updateProfile({ gameNick: nick, playstyle: style })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Zapisano konto")
          router.refresh()
        })
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="game-nick">Nick w grze</FieldLabel>
          <Input
            id="game-nick"
            value={nick}
            onChange={(event) => setNick(event.target.value)}
            maxLength={24}
            required
          />
          <FieldDescription>Taki nick zobaczą inni na siatce.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Składka na V3 (opcjonalnie)</FieldLabel>
          <ToggleGroup
            value={style ? [style] : []}
            onValueChange={(value) => setStyle((value[0] as Playstyle | undefined) ?? null)}
            spacing={2}
          >
            <ToggleGroupItem value="pvp">PVP · 3 kk</ToggleGroupItem>
            <ToggleGroupItem value="pvm">PVM · 7 kk</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>
            Dotyczy tylko V3. Jeśli nie chodzisz na V3, zostaw puste (kliknij zaznaczone, żeby odznaczyć). Zmiana nie
            przepisuje starych zapisów.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Zapisz
      </Button>
    </form>
  )
}
