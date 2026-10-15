"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ErrorNote } from "@/components/common"
import { api } from "@/lib/client"

export function LoginForm() {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ role: string }>("/api/auth/login", {
        method: "POST",
        body: { username: form.get("username"), password: form.get("password") },
      })
      router.replace(res.role === "admin" ? "/admin" : "/servers")
      router.refresh()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <h2 className="display text-3xl">Sign in</h2>
      <p className="prose-serif mt-2 text-base text-muted-foreground">Use the account your admin gave you.</p>
      <FieldGroup className="mt-8">
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input id="username" name="username" autoComplete="username" required autoFocus className="h-11 bg-background" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11 bg-background"
          />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  )
}
