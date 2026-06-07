"use client";

import { useEffect, useState } from "react";
import { Sparkles, MapPin, Target, Shirt, Car } from "lucide-react";

interface SummarySections {
  forWhom: string;
  whyGo: string;
  dressCode: string;
  transit: string;
}

interface ApiResponse {
  summary: { sections: SummarySections; cachedAt: number } | null;
  configured?: boolean;
}

interface Props {
  slug: string;
}

export function AiSummary({ slug }: Props) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; sections: SummarySections }
    | { kind: "hidden" }
    | { kind: "unconfigured" }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) {
          if (!cancelled) setState({ kind: "hidden" });
          return;
        }
        const data = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (data.configured === false) {
          setState({ kind: "unconfigured" });
        } else if (data.summary?.sections) {
          setState({ kind: "ready", sections: data.summary.sections });
        } else {
          setState({ kind: "hidden" });
        }
      } catch {
        if (!cancelled) setState({ kind: "hidden" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.kind === "hidden") return null;

  if (state.kind === "unconfigured") {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-xs text-[var(--muted)] inline-flex items-center gap-2">
        <Sparkles className="size-3.5" />
        AI özet için yapılandırma gerekli (ANTHROPIC_API_KEY).
      </section>
    );
  }

  if (state.kind === "loading") {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-[var(--primary)]" />
          <h2 className="font-semibold">AI özet</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] p-3 animate-pulse"
            >
              <div className="h-3 w-20 bg-[var(--muted-bg)] rounded mb-2" />
              <div className="h-3 w-full bg-[var(--muted-bg)] rounded mb-1" />
              <div className="h-3 w-3/4 bg-[var(--muted-bg)] rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const { sections } = state;
  const cards: { icon: typeof MapPin; label: string; text: string }[] = [
    { icon: MapPin, label: "Kim için", text: sections.forWhom },
    { icon: Target, label: "Neden gidilir", text: sections.whyGo },
    { icon: Shirt, label: "Ne giyilir", text: sections.dressCode },
    { icon: Car, label: "Otopark / Ulaşım", text: sections.transit },
  ];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-[var(--primary)]" />
        <h2 className="font-semibold">AI özet</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map(({ icon: Icon, label, text }) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]/40 p-3"
          >
            <div className="flex items-center gap-2 mb-1.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
              <Icon className="size-3.5 text-[var(--primary)]" />
              {label}
            </div>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {text}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-[var(--muted)] text-right">
        AI ile üretildi
      </p>
    </section>
  );
}
