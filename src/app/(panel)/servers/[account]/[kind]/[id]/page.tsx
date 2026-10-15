import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireUser } from "@/lib/auth"
import { getAccount } from "@/lib/accounts"
import { isKind, KIND_META } from "@/lib/kinds"
import { canAccess } from "@/lib/servers"
import { db } from "@/lib/db"
import { ServerView } from "@/components/server/server-view"

type Props = { params: Promise<{ account: string; kind: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, id } = await params
  return { title: `${isKind(kind) ? KIND_META[kind].short : "Server"} ${decodeURIComponent(id)}` }
}

export default async function ServerPage({ params }: Props) {
  const user = await requireUser()
  const { account: rawAccount, kind, id: rawId } = await params
  const id = decodeURIComponent(rawId)
  const account = getAccount(Number(rawAccount))
  if (!account || !isKind(kind) || !canAccess(user, account.id, kind, id)) notFound()
  // The name this user gave the server, if any. Admins see the Leaseweb reference.
  const assignment = db()
    .prepare("SELECT nickname FROM assignments WHERE user_id = ? AND account_id = ? AND kind = ? AND server_id = ?")
    .get(user.id, account.id, kind, id) as { nickname: string | null } | undefined
  return (
    <ServerView
      account={account.id}
      accountName={account.name}
      kind={kind}
      id={id}
      isAdmin={user.role === "admin"}
      canRename={!!assignment}
      nickname={assignment?.nickname ?? null}
    />
  )
}
