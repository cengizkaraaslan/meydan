"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Navigation, AlertTriangle, RefreshCw } from "lucide-react";
import { CITY_COORDS_LATLNG, findClosestCity, getCityLatLng, haversineKm } from "@/lib/city-geo";
import { CITIES, CATEGORY_LABELS, type EventListItem } from "@/lib/types";

type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

interface Props {
  initialEvents: EventListItem[];
}

/**
 * Konum istemi → en yakın şehri bulup etkinlikleri mesafe sırasıyla listeler.
 * - granted: navigator.geolocation
 * - denied / unsupported: kullanıcı `<select>` ile şehir seçer
 */
export function NearbyEventsClient({ initialEvents }: Props) {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedCity, setPickedCity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Değiştir" ile açılan manuel şehir seçim modu (GPS verilmiş olsa bile).
  const [manualMode, setManualMode] = useState(false);

  // İlk yüklemede konum izni iste
  useEffect(() => {
    if (status !== "idle") return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      (err) => {
        setStatus("denied");
        setError(err.message || "Konum alınamadı.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, [status]);

  // Aktif konum: manuel seçilen şehir GPS'i EZER (kullanıcı "Değiştir" deyince
  // gerçekten değişsin diye); yoksa GPS koordinatı.
  const myCoords = useMemo(() => {
    if (pickedCity) return getCityLatLng(pickedCity) ?? null;
    if (coords) return coords;
    return null;
  }, [coords, pickedCity]);

  // En yakın bilinen şehir (header label için)
  const myCityLabel = useMemo(() => {
    if (pickedCity) return pickedCity;
    if (!myCoords) return null;
    return findClosestCity(myCoords.lat, myCoords.lng)?.city ?? null;
  }, [myCoords, pickedCity]);

  // Etkinlikleri mesafeye göre sırala (bilinmeyen şehirleri sona koy)
  const sorted = useMemo(() => {
    if (!myCoords) return [];
    return initialEvents
      .map((e) => {
        const c = CITY_COORDS_LATLNG[e.city] ?? getCityLatLng(e.city);
        const d = c ? haversineKm(myCoords, c) : Number.POSITIVE_INFINITY;
        return { event: e, distanceKm: d };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [initialEvents, myCoords]);

  function retryLocation() {
    setError(null);
    setPickedCity(null);
    setCoords(null);
    setManualMode(false);
    setStatus("idle");
  }

  // "Değiştir" → manuel şehir seçiciyi aç (GPS verilmiş olsa bile şehir değiştirilebilsin).
  function openManualPicker() {
    setPickedCity(null);
    setManualMode(true);
  }

  // === Render durumları ===

  if (status === "requesting") {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] animate-pulse">
          <Navigation className="size-5" />
        </span>
        <div>
          <div className="font-medium">Konum isteniyor…</div>
          <div className="text-sm text-[var(--muted)]">Tarayıcınız izin sorabilir.</div>
        </div>
      </div>
    );
  }

  if ((manualMode || status === "denied" || status === "unsupported") && !pickedCity) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex items-start gap-3 mb-4">
          <span className={`grid size-10 place-items-center rounded-xl shrink-0 ${manualMode ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-amber-500/10 text-amber-600"}`}>
            {manualMode ? <MapPin className="size-5" /> : <AlertTriangle className="size-5" />}
          </span>
          <div>
            <div className="font-semibold">
              {manualMode
                ? "Şehir değiştir"
                : status === "unsupported"
                ? "Tarayıcı konumu desteklemiyor"
                : "Konum izni verilmedi"}
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">
              {manualMode
                ? "Hangi şehirdeki etkinlikleri görmek istersin?"
                : error ?? "Hangi şehirdesin? Aşağıdan seç, sana göre sıralayalım."}
            </p>
          </div>
        </div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
          Şehir seç
        </label>
        <select
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              setPickedCity(v);
              setManualMode(false);
            }
          }}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        >
          <option value="" disabled>— Şehrini seç —</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={retryLocation}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
        >
          <RefreshCw className="size-3.5" />
          Tekrar konum iste
        </button>
      </div>
    );
  }

  if (!myCoords || !myCityLabel) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Konum kartı */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
            <MapPin className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-[var(--muted)] font-semibold">
              {pickedCity ? "Seçilen Konum" : "Konum"}
            </div>
            <div className="font-semibold truncate">📍 {myCityLabel}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={openManualPicker}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted-bg)] transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Değiştir
        </button>
      </div>

      {/* Liste */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-center">
          <div className="text-4xl mb-2">🗓️</div>
          <p className="text-sm text-[var(--muted)]">Görüntülenecek etkinlik bulunamadı.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {sorted.map(({ event, distanceKm }) => (
            <li key={event.id}>
              <NearbyCard event={event} distanceKm={distanceKm} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NearbyCard({ event, distanceKm }: { event: EventListItem; distanceKm: number }) {
  const dateLabel = event.startsAt.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
  const distLabel = !Number.isFinite(distanceKm)
    ? "—"
    : distanceKm < 1
    ? "< 1 km"
    : `${Math.round(distanceKm)} km`;

  return (
    <Link
      href={`/etkinlik/${event.slug}`}
      className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5 transition-shadow"
    >
      <div className="grid size-14 place-items-center rounded-xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 text-[var(--primary)] shrink-0">
        <span className="text-lg font-bold">{Math.round(distanceKm) || "<1"}</span>
        <span className="text-[10px] -mt-1 tracking-wider text-[var(--muted)]">km</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mb-0.5">
          <span className="rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 text-[10px] font-medium">
            {CATEGORY_LABELS[event.category]}
          </span>
          <span>•</span>
          <span>{dateLabel}</span>
        </div>
        <div className="font-semibold text-sm truncate group-hover:text-[var(--primary)] transition-colors">
          {event.title}
        </div>
        <div className="text-xs text-[var(--muted)] truncate flex items-center gap-1 mt-0.5">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{event.venue} • {event.city}</span>
        </div>
      </div>
      <div className="shrink-0 text-right text-xs text-[var(--muted)] hidden sm:block">
        {distLabel}
      </div>
    </Link>
  );
}
