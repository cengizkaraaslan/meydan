import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LogIn, MessageCircle } from "lucide-react";
import { getEventBySlug } from "@/lib/events";
import { getRoomMessages } from "@/lib/event-chat-store";
import { EventChatView } from "@/components/EventChatView";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function EventChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const session = await auth().catch(() => null);
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center space-y-4">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
            <MessageCircle className="size-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Grup sohbeti için giriş gerekli</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">{event.title}</span> sohbetine yazmak için önce giriş yap.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href={`/giris?callbackUrl=/etkinlik/${encodeURIComponent(event.slug)}/sohbet`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary"
            >
              <LogIn className="size-4" />
              Giriş yap
            </Link>
            <Link
              href={`/etkinlik/${event.slug}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted-bg)] transition-colors"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
              Etkinliğe dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initialMessages = await getRoomMessages(event.slug);

  return (
    <EventChatView
      slug={event.slug}
      eventTitle={event.title}
      attendeeCount={event.attendeeCount ?? 0}
      initialMessages={initialMessages}
    />
  );
}
