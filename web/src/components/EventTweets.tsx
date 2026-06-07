"use client";

import { useEffect, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";

interface Tweet {
  id: string;
  text: string;
  createdAt?: string;
  likes: number;
  authorName: string;
  authorHandle: string;
  authorAvatar: string | null;
  url: string;
}
interface ApiResp {
  available: boolean;
  tweets: Tweet[];
  searchUrl: string | null;
}

/** Etkinlikle ilgili X (Twitter) gönderileri — lazy, sayfayı bloklamaz. */
export function EventTweets({ query }: { query: string }) {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/event-tweets?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d: ApiResp) => alive && setData(d))
      .catch(() => alive && setData({ available: false, tweets: [], searchUrl: null }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-3">
        <span className="text-[#1d9bf0]">𝕏</span> Sosyal medyada
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)] py-2">
          <Loader2 className="size-4 animate-spin" /> Yükleniyor…
        </div>
      ) : data && data.available && data.tweets.length > 0 ? (
        <div className="space-y-3">
          {data.tweets.slice(0, 3).map((t) => (
            <a
              key={t.id}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--muted-bg)]/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                {t.authorAvatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.authorAvatar} alt="" className="size-6 rounded-full" />
                )}
                <span className="text-sm font-medium truncate">{t.authorName}</span>
                <span className="text-xs text-[var(--muted)] truncate">@{t.authorHandle}</span>
              </div>
              <p className="text-sm text-[var(--foreground)] line-clamp-4">{t.text}</p>
              {t.likes > 0 && <div className="mt-1 text-xs text-[var(--muted)]">❤️ {t.likes}</div>}
            </a>
          ))}
          {data.searchUrl && (
            <a
              href={data.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              Daha fazla — X&apos;te gör <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      ) : (
        // Anahtar yok / sonuç yok → ücretsiz arama linki
        <div className="text-sm text-[var(--muted)]">
          <p className="mb-2">Bu etkinlikle ilgili güncel paylaşımları X&apos;te ara:</p>
          {data?.searchUrl && (
            <a
              href={data.searchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              𝕏 X&apos;te ara <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      )}
    </section>
  );
}
