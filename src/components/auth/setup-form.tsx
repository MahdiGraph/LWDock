"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ErrorNote } from "@/components/common"
import { api } from "@/lib/client"

export function SetupForm() {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (form.get("password") !== form.get("confirm")) {
      setError(new Error("The two passwords do not match."))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api("/api/auth/setup", {
        method: "POST",
        body: { name: form.get("name"), username: form.get("username"), password: form.get("password") },
      })
      router.replace("/admin/settings")
      router.refresh()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <h2 className="display text-3xl">Create the admin</h2>
      <p className="prose-serif mt-2 text-base text-muted-foreground">
        This account adds the Leaseweb API key, creates users and decides who gets which server.
      </p>
      <FieldGroup className="mt-8">
        <Field>
          <FieldLabel htmlFor="name">Your name</FieldLabel>
          <Input id="name" name="name" autoComplete="name" className="h-11 bg-background" />
        </Field>
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input id="username" name="username" autoComplete="username" required minLength={3} className="h-11 bg-background" />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11 bg-background" />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm">Repeat the password</FieldLabel>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11 bg-background" />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Create admin and continue
        </Button>
      </FieldGroup>
    </form>
  )
}
