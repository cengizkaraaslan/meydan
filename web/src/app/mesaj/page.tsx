import Link from "next/link";
import { LogIn, MessageCircle } from "lucide-react";
import { getConversations } from "@/lib/messaging";
import { CURRENT_USERNAME, getPartnerInfo } from "@/lib/messaging-data";
import { InboxList, type InboxItem } from "@/components/InboxList";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mesajlar — EtkinlikScout",
};

export default async function MessagesInboxPage() {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center space-y-4">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
            <MessageCircle className="size-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Mesajlar için giriş gerekli</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Sohbetlerini görmek ve mesaj atmak için önce giriş yap.
            </p>
          </div>
          <Link
            href="/giris?callbackUrl=/mesaj"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
          >
            <LogIn className="size-4" />
            Giriş yap
          </Link>
        </div>
      </div>
    );
  }

  const conversations = await getConversations();

  const items: InboxItem[] = conversations.map((c) => {
    const info = getPartnerInfo(c.username);
    const name = info?.name ?? c.username;
    const color = info?.color ?? "#6366f1";
    return {
      username: c.username,
      name,
      color,
      avatarUrl: info?.avatarUrl,
      lastMessageText: c.lastMessage.text,
      lastMessageAt: c.lastMessage.createdAt.toISOString(),
      lastMessageFromMe: c.lastMessage.senderUsername === CURRENT_USERNAME,
      unreadCount: c.unreadCount,
    };
  });

  return (
    <div className="mx-auto max-w-6xl h-[calc(100vh-4rem-5rem)] md:h-[calc(100vh-4rem)]">
      <div className="grid h-full md:grid-cols-[360px_1fr] border-y md:border md:rounded-2xl md:my-4 border-[var(--border)] bg-[var(--card)] md:overflow-hidden">
        <div className="flex flex-col h-full border-e border-[var(--border)] min-h-0 overflow-y-auto">
          <div className="px-4 pt-4 pb-2 border-b border-[var(--border)]">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="size-5 text-[var(--primary)]" />
              Mesajlar
            </h1>
          </div>
          <InboxList items={items} />
        </div>
        <div className="hidden md:flex items-center justify-center text-center px-8">
          <div className="text-[var(--muted)]">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[var(--muted-bg)]">
              <MessageCircle className="size-8 opacity-60" />
            </div>
            <p className="font-medium text-[var(--foreground)]">Bir konuşma seç</p>
            <p className="text-sm mt-1">Mesajlaşmaya başlamak için soldan bir kişi seç.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
