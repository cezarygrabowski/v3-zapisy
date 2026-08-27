import { redirect } from "next/navigation"
import { signIn } from "@/auth"
import { DevLoginForm } from "@/components/dev-login-form"
import { PasswordLoginForm } from "@/components/password-login-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isDevLoginEnabled } from "@/lib/constants"
import { getCurrentUser } from "@/lib/session"

export const dynamic = "force-dynamic"

function errorMessage(error: string | undefined) {
  if (!error) return null
  if (error === "AccessDenied" || error === "NotInGuild") {
    return "Nie jesteś na Discordzie gildii albo logowanie zostało odrzucone."
  }
  if (error === "CredentialsSignin") {
    return "Zły login albo hasło."
  }
  if (error === "Configuration") {
    return "Logowanie nie jest jeszcze skonfigurowane. Brakuje AUTH_SECRET albo danych Discord."
  }
  return "Nie udało się zalogować. Spróbuj jeszcze raz."
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getCurrentUser()
  if (user) redirect("/")

  const params = await searchParams
  const error = typeof params.error === "string" ? params.error : undefined
  const discordConfigured = Boolean(
    process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET
  )
  const message = errorMessage(error)

  async function loginDiscord() {
    "use server"
    await signIn("discord", { redirectTo: "/" })
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>V3 zapisy</CardTitle>
          <CardDescription>
            Discord gildii albo login i hasło od admina. Random z linkiem nic tu nie zobaczy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert variant="destructive">
              <AlertTitle>Brak dostępu</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {discordConfigured ? (
            <form action={loginDiscord}>
              <Button type="submit" className="w-full">
                Zaloguj przez Discord
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Discord OAuth nie jest jeszcze ustawiony. Dodaj AUTH_DISCORD_ID i AUTH_DISCORD_SECRET.
            </p>
          )}

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">albo</span>
            </div>
          </div>

          <PasswordLoginForm />

          {isDevLoginEnabled() ? (
            <div className="flex flex-col gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Tryb deweloperski (DEV_LOGIN=true, nie działa na produkcji).
              </p>
              <DevLoginForm />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
