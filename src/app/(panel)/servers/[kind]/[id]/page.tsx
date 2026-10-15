import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireUser } from "@/lib/auth"
import { isKind, KIND_META } from "@/lib/kinds"
import { canAccess } from "@/lib/servers"
import { ServerView } from "@/components/server/server-view"

type Props = { params: Promise<{ kind: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, id } = await params
  return { title: `${isKind(kind) ? KIND_META[kind].short : "Server"} ${decodeURIComponent(id)}` }
}

export default async function ServerPage({ params }: Props) {
  const user = await requireUser()
  const { kind, id: rawId } = await params
  const id = decodeURIComponent(rawId)
  if (!isKind(kind) || !canAccess(user, kind, id)) notFound()
  return <ServerView kind={kind} id={id} isAdmin={user.role === "admin"} />
}
