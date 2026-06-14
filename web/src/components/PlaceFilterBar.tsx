"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { CITIES, PLACE_TYPE_LABELS, type PlaceType } from "@/lib/types";

/** /yerler için sade filtre çubuğu: şehir + tür + arama (tarih YOK — yerler kalıcı). */
export function PlaceFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // filtre değişti → ilk sayfa
    router.push(`${pathname}?${next.toString()}`);
  };

  const city = params.get("city") ?? "";
  const type = params.get("type") ?? "";
  const q = params.get("q") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted)]" />
        <input
          type="search"
          defaultValue={q}
          placeholder="Müze veya yer ara…"
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value.trim());
          }}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 ps-9 pe-3 text-sm outline-none focus:border-[var(--primary)]"
        />
      </div>
      <select
        value={city}
        onChange={(e) => setParam("city", e.target.value)}
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 px-3 text-sm outline-none focus:border-[var(--primary)]"
      >
        <option value="">Tüm şehirler</option>
        {CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select
        value={type}
        onChange={(e) => setParam("type", e.target.value)}
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 px-3 text-sm outline-none focus:border-[var(--primary)]"
      >
        <option value="">Tüm türler</option>
        {(Object.keys(PLACE_TYPE_LABELS) as PlaceType[]).map((t) => (
          <option key={t} value={t}>{PLACE_TYPE_LABELS[t]}</option>
        ))}
      </select>
    </div>
  );
}
