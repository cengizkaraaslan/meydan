import Link from "next/link";
import { notFound } from "next/navigation";
import { LogIn, MessageCircle } from "lucide-react";
import { ensureConversation, getConversation } from "@/lib/messaging";
import { getPartnerInfo } from "@/lib/messaging-data";
import { findUserByUsername } from "@/lib/social-data";
import { ConversationView } from "@/components/ConversationView";
import type { SerializedMessage } from "@/lib/messaging-actions";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const clean = decodeURIComponent(username).replace(/^@/, "").toLowerCase();

  const session = await auth().catch(() => null);
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center space-y-4">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
            <MessageCircle className="size-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Mesajlaşmak için giriş gerekli</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">@{clean}</span> ile yazışmak için önce giriş yap.
            </p>
          </div>
          <Link
            href={`/giris?callbackUrl=/mesaj/${encodeURIComponent(clean)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
          >
            <LogIn className="size-4" />
            Giriş yap
          </Link>
        </div>
      </div>
    );
  }

  // Resolve partner info from MOCK_USERS or fall back gracefully
  const seedUser = findUserByUsername(clean) ?? getPartnerInfo(clean);
  if (!seedUser && !clean.match(/^[a-z0-9_-]+$/)) {
    notFound();
  }

  const partner = {
    username: clean,
    name: seedUser?.name ?? clean.charAt(0).toUpperCase() + clean.slice(1),
    color: seedUser?.color ?? "#6366f1",
    bio: seedUser?.bio ?? "",
    avatarUrl: seedUser?.avatarUrl,
  };

  // Make sure conversation exists (DB modunda no-op, in-memory'de oluşturur)
  await ensureConversation(clean);
  const conv = await getConversation(clean);

  const initialMessages: SerializedMessage[] = (conv?.messages ?? []).map((m) => ({
    id: m.id,
    senderUsername: m.senderUsername,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt?.toISOString(),
  }));

  return <ConversationView partner={partner} initialMessages={initialMessages} />;
}
