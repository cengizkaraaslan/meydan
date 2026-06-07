"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Loader2, X } from "lucide-react";

interface SearchResponse {
  redirectTo: string;
  summary: string;
}

export function SmartSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileOpen) {
      // Mobil sheet açıldığında input'a focus ver + body scroll'u kilitle
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => mobileInputRef.current?.focus());
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  async function runSearch(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as SearchResponse;
      router.push(data.redirectTo);
    } catch {
      router.push(`/etkinlikler?q=${encodeURIComponent(trimmed)}`);
    } finally {
      setLoading(false);
      setMobileOpen(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void runSearch(query);
  }

  return (
    <>
      {/* Masaüstü / tablet inline arama */}
      <form
        onSubmit={handleSubmit}
        className="hidden md:flex items-center gap-2 rounded-full bg-[var(--muted-bg)] hover:bg-[var(--border)] focus-within:bg-[var(--border)] px-4 py-2 text-sm flex-1 max-w-md transition-colors"
      >
        {loading ? (
          <Loader2 className="size-4 text-[var(--primary)] animate-spin shrink-0" />
        ) : (
          <Search className="size-4 text-[var(--muted)] shrink-0" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ne arıyorsun? Örn: İstanbul'da hafta sonu ücretsiz konser"
          aria-label="Akıllı arama"
          disabled={loading}
          className="flex-1 bg-transparent outline-none placeholder:text-[var(--muted)] text-[var(--foreground)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="shrink-0 text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
        >
          Ara
        </button>
      </form>

      {/* Mobil arama butonu — overlay sheet açar */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Aramayı aç"
        className="md:hidden grid place-items-center rounded-full border border-[var(--border)] size-9 hover:bg-[var(--muted-bg)] transition-colors"
      >
        <Search className="size-4" />
      </button>

      {/* Mobil fullscreen arama sheet'i */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="search-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="md:hidden fixed inset-0 z-[60] bg-[var(--background)]/95 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="mx-3 mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-3"
            >
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 rounded-xl bg-[var(--muted-bg)] px-3 py-2.5"
              >
                {loading ? (
                  <Loader2 className="size-4 text-[var(--primary)] animate-spin shrink-0" />
                ) : (
                  <Search className="size-4 text-[var(--muted)] shrink-0" />
                )}
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ne arıyorsun?"
                  aria-label="Akıllı arama"
                  disabled={loading}
                  className="flex-1 bg-transparent outline-none placeholder:text-[var(--muted)] text-[var(--foreground)] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Kapat"
                  className="grid place-items-center size-7 rounded-full text-[var(--muted)] hover:bg-[var(--border)]"
                >
                  <X className="size-4" />
                </button>
              </form>
              <div className="mt-3 px-1 text-xs text-[var(--muted)]">
                Örn: İstanbul'da hafta sonu ücretsiz konser
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
