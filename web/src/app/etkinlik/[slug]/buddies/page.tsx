import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { BuddyMatchmaker } from "@/components/BuddyMatchmaker";
import { getEventBySlug } from "@/lib/events";
import { MOCK_USERS } from "@/lib/social-data";

export const revalidate = 300;

export default async function BuddiesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/etkinlik/${event.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Etkinliğe dön
      </Link>

      <header className="mt-6 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white">
          <Sparkles className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Birlikte gidebileceğin kişiler</h1>
          <p className="text-sm text-[var(--muted)] truncate">{event.title}</p>
        </div>
        <span className="ms-auto rounded-full bg-[var(--muted-bg)] px-3 py-1 text-sm font-semibold tabular-nums">
          {MOCK_USERS.length}
        </span>
      </header>

      <p className="mt-3 text-sm text-[var(--muted)]">
        İlgi alanları, şehir ve etkinlik kategorisine göre eşleştirildi. Mesaj atarak ya da takip ederek tanışmaya başla.
      </p>

      <div className="mt-6">
        <BuddyMatchmaker
          eventId={event.id}
          city={event.city}
          category={event.category}
          limit={MOCK_USERS.length}
          hideViewAllLink
        />
      </div>
    </div>
  );
}
