"use client"

import * as React from "react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { Board, Facts, PageHeader, Tile } from "@/components/board"
import { ErrorNote } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/client"
import { formatDate } from "@/lib/format"

export function AccountForm({
  user,
}: {
  user: { username: string; name: string | null; role: string; createdAt: number }
}) {
  const { theme, setTheme } = useTheme()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<unknown>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (form.get("newPassword") !== form.get("confirm")) {
      setError(new Error("The two new passwords do not match."))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api("/api/account/password", {
        method: "POST",
        body: { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") },
      })
      formRef.current?.reset()
      toast.success("Password changed. Other devices were signed out.")
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Account" />
      <Board>
        <Tile className="col-span-12 lg:col-span-5">
          <p className="display text-4xl">{user.name || user.username}</p>
          <Facts
            className="mt-8"
            items={[
              ["Username", user.username],
              ["Role", user.role === "admin" ? "Admin" : "User"],
              ["Member since", formatDate(user.createdAt)],
            ]}
          />
          <div className="mt-10">
            <p className="text-sm font-medium">Appearance</p>
            <RadioGroup value={theme ?? "system"} onValueChange={setTheme} className="mt-3 flex flex-wrap gap-4">
              {(["light", "dark", "system"] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value={t} /> {t === "system" ? "Match the system" : t === "light" ? "Light" : "Dark"}
                </label>
              ))}
            </RadioGroup>
          </div>
        </Tile>
        <Tile tone="tile" className="col-span-12 lg:col-span-7">
          <form ref={formRef} method="post" onSubmit={submit} className="max-w-md">
            <h2 className="display text-3xl">Change password</h2>
            <FieldGroup className="mt-6">
              <Field>
                <FieldLabel htmlFor="current">Current password</FieldLabel>
                <Input id="current" name="currentPassword" type="password" autoComplete="current-password" required className="bg-background" />
              </Field>
              <Field>
                <FieldLabel htmlFor="new">New password</FieldLabel>
                <Input id="new" name="newPassword" type="password" autoComplete="new-password" minLength={8} required className="bg-background" />
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm">Repeat the new password</FieldLabel>
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="bg-background" />
              </Field>
              <ErrorNote error={error} />
              <div>
                <Button type="submit" disabled={busy}>
                  {busy ? <Spinner /> : null} Change password
                </Button>
              </div>
            </FieldGroup>
          </form>
        </Tile>
      </Board>
    </>
  )
}
