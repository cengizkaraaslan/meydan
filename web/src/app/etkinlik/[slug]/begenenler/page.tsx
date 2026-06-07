import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart } from "lucide-react";
import { getEventBySlug } from "@/lib/events";
import { seedLikersFor, seedLikeCount } from "@/lib/social-data";
import { Avatar } from "@/components/ui/Avatar";

export const revalidate = 300;

export default async function LikersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const likers = seedLikersFor(event.id);
  const totalCount = seedLikeCount(event.id);
  const remaining = Math.max(0, totalCount - likers.length);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/etkinlik/${event.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Etkinliğe dön
      </Link>

      <header className="mt-6 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-[var(--danger)]/15 text-[var(--danger)]">
          <Heart className="size-6 fill-current" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Beğenenler</h1>
          <p className="text-sm text-[var(--muted)]">{event.title}</p>
        </div>
        <span className="ms-auto rounded-full bg-[var(--muted-bg)] px-3 py-1 text-sm font-semibold tabular-nums">
          {totalCount.toLocaleString("tr-TR")}
        </span>
      </header>

      <ul className="mt-6 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {likers.map((u) => (
          <li key={u.username}>
            <Link
              href={`/profil/${u.username}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted-bg)] transition-colors"
            >
              <Avatar
                src={u.avatarUrl}
                name={u.name}
                color={u.color}
                size="size-11"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{u.name}</div>
                <div className="text-xs text-[var(--muted)] truncate">@{u.username} • {u.followers.toLocaleString("tr-TR")} takipçi</div>
              </div>
              <button className="rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-3 py-1 text-xs font-medium hover:bg-[var(--primary)]/20 transition-colors">
                Takip Et
              </button>
            </Link>
          </li>
        ))}
        {remaining > 0 && (
          <li className="px-4 py-3 text-center text-sm text-[var(--muted)]">
            +{remaining.toLocaleString("tr-TR")} kişi daha
          </li>
        )}
      </ul>
    </div>
  );
}
