import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function PasswordLoginForm() {
  async function login(formData: FormData) {
    "use server"
    const login = String(formData.get("login") ?? "")
    const password = String(formData.get("password") ?? "")
    try {
      await signIn("password", { login, password, redirectTo: "/run" })
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login?error=CredentialsSignin")
      }
      throw error
    }
  }

  return (
    <form action={login} className="flex flex-col items-start gap-4">
      <FieldGroup className="w-full">
        <Field>
          <FieldLabel htmlFor="login">Login</FieldLabel>
          <Input
            id="login"
            name="login"
            autoComplete="username"
            required
            minLength={3}
            maxLength={24}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Hasło</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
        </Field>
      </FieldGroup>
      <Button type="submit">Zaloguj</Button>
    </form>
  )
}
