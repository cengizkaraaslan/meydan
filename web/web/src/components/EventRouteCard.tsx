"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Loader2,
  Navigation,
  Car,
  Footprints,
  Bus,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getCityLatLng, haversineKm, type LatLng } from "@/lib/city-geo";
import { playClick } from "@/lib/sounds";

interface EventRouteCardProps {
  /** Mekan adı, örn: "Kentpark Yeni Festival Alanı" */
  venue: string;
  /** Şehir, örn: "Eskişehir" */
  city: string;
  /** İlçe (opsiyonel), örn: "Tepebaşı" */
  district?: string;
}

interface CachedPos {
  lat: number;
  lng: number;
  at: number;
}

const CACHE_KEY = "meydanfest.route.userPos";
const CACHE_TTL_MS = 30 * 60_000; // 30 dakika

function readCachedPos(): CachedPos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPos;
    if (
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      typeof parsed.at !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedPos(pos: CachedPos) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(pos));
  } catch {
    // ignore quota / private mode
  }
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua);
}

type Status = "idle" | "loading" | "resolved" | "denied" | "unsupported";

export function EventRouteCard({ venue, city, district }: EventRouteCardProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [iosHint, setIosHint] = useState(false);

  // Destination address + koordinat
  const destAddress = useMemo(() => {
    const parts = [venue, district, city, "Türkiye"].filter(
      (s): s is string => !!s && s.trim().length > 0,
    );
    return parts.join(", ");
  }, [venue, city, district]);

  const destCoords = useMemo<LatLng | null>(() => {
    return getCityLatLng(city) ?? null;
  }, [city]);

  // Tarayıcı / cache kontrolü
  useEffect(() => {
    setIosHint(isIOS());
    if (typeof navigator !== "undefined" && !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    const cached = readCachedPos();
    if (cached) {
      setUserPos({ lat: cached.lat, lng: cached.lng });
      setStatus("resolved");
    }
  }, []);

  function requestLocation() {
    playClick();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: CachedPos = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          at: Date.now(),
        };
        writeCachedPos(next);
        setUserPos({ lat: next.lat, lng: next.lng });
        setStatus("resolved");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Konum izni reddedildi. Yine de haritada açabilirsin.");
          setStatus("denied");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast.error("Konumun şu an alınamıyor");
          setStatus("denied");
        } else if (err.code === err.TIMEOUT) {
          toast.error("Konum zaman aşımı");
          setStatus("denied");
        } else {
          toast.error("Konum alınamadı");
          setStatus("denied");
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  // Mesafe + tahmini süreler
  const estimates = useMemo(() => {
    if (!userPos || !destCoords) return null;
    const distanceKm = haversineKm(userPos, destCoords);
    const drivingMin = Math.round((distanceKm / 60) * 60);
    const walkingMin = Math.round((distanceKm / 5) * 60);
    const transitMin = Math.round((distanceKm / 30) * 60);
    return { distanceKm, drivingMin, walkingMin, transitMin };
  }, [userPos, destCoords]);

  // Maps URL'leri
  const encodedDest = encodeURIComponent(destAddress);

  function googleMapsUrl(): string {
    if (userPos) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userPos.lat},${userPos.lng}&destination=${encodedDest}&travelmode=driving`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}&travelmode=driving`;
  }

  function yandexUrl(): string {
    if (userPos && destCoords) {
      return `https://yandex.com.tr/maps/?rtext=${userPos.lat},${userPos.lng}~${destCoords.lat},${destCoords.lng}&rtt=auto`;
    }
    if (destCoords) {
      return `https://yandex.com.tr/maps/?text=${encodedDest}&ll=${destCoords.lng},${destCoords.lat}&z=14`;
    }
    return `https://yandex.com.tr/maps/?text=${encodedDest}`;
  }

  function appleMapsUrl(): string {
    if (userPos) {
      return `https://maps.apple.com/?saddr=${userPos.lat},${userPos.lng}&daddr=${encodedDest}`;
    }
    return `https://maps.apple.com/?daddr=${encodedDest}`;
  }

  const tooFar = estimates ? estimates.distanceKm > 500 : false;
  const hideWalking = estimates ? estimates.walkingMin > 480 : false;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Navigation className="size-4 text-[var(--primary)]" />
            Konumumdan Rota
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)] inline-flex items-start gap-1.5">
            <MapPin className="size-4 mt-0.5 shrink-0" />
            <span>
              <span className="text-[var(--foreground)] font-medium">
                {venue}
              </span>
              {district ? `, ${district}` : ""}, {city}
            </span>
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {status === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              onClick={requestLocation}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary)]/40 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 hover:from-[var(--primary)]/15 hover:to-[var(--accent)]/15 px-4 py-2.5 text-sm font-medium text-[var(--primary)] transition-all"
            >
              <MapPin className="size-4" />
              📍 Konumumu kullan
            </button>
          </motion.div>
        )}

        {status === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-center gap-2 py-4 text-sm text-[var(--muted)]"
          >
            <Loader2 className="size-4 animate-spin" />
            Konumun alınıyor...
          </motion.div>
        )}

        {status === "resolved" && estimates && (
          <motion.div
            key="resolved"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {tooFar && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent)]">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  Çok uzak ({Math.round(estimates.distanceKm)} km) — uçak öneririz
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-xs">
              <EstimateChip
                icon={<Car className="size-4" />}
                label="🚗"
                value={`${estimates.drivingMin} dk`}
              />
              {!hideWalking && (
                <EstimateChip
                  icon={<Footprints className="size-4" />}
                  label="🚶"
                  value={`${estimates.walkingMin} dk`}
                />
              )}
              <EstimateChip
                icon={<Bus className="size-4" />}
                label="🚌"
                value={`${estimates.transitMin} dk`}
              />
            </div>

            <div className="text-[11px] text-[var(--muted)] -mt-1">
              ~{estimates.distanceKm.toFixed(1)} km kuş uçumu • tahminî süre
            </div>

            <div className="grid gap-2">
              <RouteLink
                href={googleMapsUrl()}
                label="Google Maps'te Aç"
                tone="primary"
              />
              <RouteLink href={yandexUrl()} label="Yandex Navi" tone="default" />
              {iosHint && (
                <RouteLink
                  href={appleMapsUrl()}
                  label="Apple Maps"
                  tone="default"
                />
              )}
            </div>
          </motion.div>
        )}

        {(status === "denied" || status === "unsupported") && (
          <motion.div
            key="denied"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            <p className="text-xs text-[var(--muted)]">
              Konum izni vermek istemezsen direkt aç:
            </p>
            <div className="grid gap-2">
              <RouteLink
                href={googleMapsUrl()}
                label="Google Maps'te Aç"
                tone="primary"
              />
              <RouteLink href={yandexUrl()} label="Yandex Navi" tone="default" />
            </div>
            <button
              type="button"
              onClick={requestLocation}
              className="text-xs text-[var(--primary)] hover:underline"
            >
              Tekrar dene
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {status === "resolved" && (
        <button
          type="button"
          onClick={requestLocation}
          className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Konumu yenile
        </button>
      )}
    </section>
  );
}

function EstimateChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]/40 py-2.5">
      <span className="inline-flex items-center gap-1 text-[var(--muted)]">
        {icon}
        <span aria-hidden>{label}</span>
      </span>
      <strong className="text-sm text-[var(--foreground)]">{value}</strong>
    </div>
  );
}

function RouteLink({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "primary" | "default";
}) {
  const cls =
    tone === "primary"
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 glow-primary"
      : "border border-[var(--border)] hover:bg-[var(--muted-bg)]";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => playClick()}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${cls}`}
    >
      <Navigation className="size-4" />
      {label}
      <ExternalLink className="size-3.5 opacity-70" />
    </a>
  );
}
