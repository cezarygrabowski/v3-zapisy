import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function DevLoginForm() {
  async function login(formData: FormData) {
    "use server"
    const name = String(formData.get("name") ?? "Dev")
    const leader = formData.get("leader") === "on" ? "true" : "false"
    await signIn("dev", { name, leader, redirectTo: "/run" })
  }

  return (
    <form action={login} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="dev-name">Nick</FieldLabel>
          <Input id="dev-name" name="name" defaultValue="Cezary" required />
        </Field>
        <Field orientation="horizontal">
          <input
            id="dev-leader"
            name="leader"
            type="checkbox"
            className="size-4 accent-primary"
          />
          <FieldLabel htmlFor="dev-leader" className="font-normal">
            Zaloguj jako admin
          </FieldLabel>
        </Field>
      </FieldGroup>
      <Button type="submit">Wejście deweloperskie</Button>
    </form>
  )
}
