import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function PasswordLoginForm() {
  async function login(formData: FormData) {
    "use server"
    const login = String(formData.get("login") ?? "")
    const password = String(formData.get("password") ?? "")
    await signIn("password", { login, password, redirectTo: "/" })
  }

  return (
    <form action={login} className="flex flex-col gap-4">
      <FieldGroup>
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
      <Button type="submit" className="w-full">
        Zaloguj loginem
      </Button>
    </form>
  )
}
