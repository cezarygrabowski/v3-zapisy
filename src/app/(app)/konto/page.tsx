import { PasswordSettings } from "@/components/password-settings"
import { ProfileForm } from "@/components/profile-form"
import { CharacterManagement } from "@/components/character-management"
import { listUserCharacters } from "@/lib/actions/characters"
import type { Playstyle } from "@/lib/constants"
import { requireUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const user = await requireUser()
  const characters = await listUserCharacters(user.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">Konto</h1>
        <p className="text-sm text-muted-foreground">
          Zarządzaj swoimi postaciami, danymi profilu oraz hasłem dostępu.
        </p>
      </div>

      <CharacterManagement initialCharacters={characters} />

      <div className="flex max-w-md flex-col gap-2 pt-2 border-t">
        <h2 className="font-heading text-lg font-semibold">Profil konta</h2>
        <p className="text-sm text-muted-foreground">
          Główny nick i typ konta (PVP płaci 3 kk za wejście, PVM 7 kk).
        </p>
      </div>
      <ProfileForm
        gameNick={user.gameNick}
        playstyle={(user.playstyle as Playstyle | null) ?? null}
      />

      <div className="flex max-w-md flex-col gap-2 pt-2 border-t">
        <h2 className="font-heading text-lg font-semibold">Login i hasło</h2>
        <p className="text-sm text-muted-foreground">
          Działa obok Discorda. Konto z samym hasłem zakłada admin.
        </p>
      </div>
      <PasswordSettings login={user.login} />
    </div>
  )
}
