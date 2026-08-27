"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setOwnPassword } from "@/lib/actions/profile"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function PasswordSettings({ login }: { login: string | null }) {
  const [nextLogin, setNextLogin] = useState(login ?? "")
  const [password, setPassword] = useState("")
  const [pending, startTransition] = useTransition()
  const hasLogin = Boolean(login)

  return (
    <form
      className="flex max-w-md flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await setOwnPassword({
            login: hasLogin ? undefined : nextLogin,
            password,
          })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          setPassword("")
          toast.success(result.message ?? "Zapisano")
        })
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="account-login">Login</FieldLabel>
          <Input
            id="account-login"
            value={hasLogin ? login ?? "" : nextLogin}
            onChange={(event) => setNextLogin(event.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={24}
            required={!hasLogin}
            readOnly={hasLogin}
            disabled={hasLogin}
          />
          <FieldDescription>
            {hasLogin
              ? "Tym loginem wchodzisz oprócz Discorda."
              : "Ustaw login i hasło, żeby wchodzić bez Discorda."}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="account-password">{hasLogin ? "Nowe hasło" : "Hasło"}</FieldLabel>
          <Input
            id="account-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {hasLogin ? "Zmień hasło" : "Włącz logowanie hasłem"}
      </Button>
    </form>
  )
}
