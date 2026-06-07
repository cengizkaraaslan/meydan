"use client";

import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { findClosestCity } from "@/lib/city-geo";

interface NearestCityButtonProps {
  /** Şehir tespit edildiğinde çağrılır */
  onResolve: (city: string) => void;
  className?: string;
  /** "compact" → küçük chip, "full" → kart genişliği buton */
  variant?: "compact" | "full";
}

/**
 * Geolocation ile en yakın il tespit edip seçer.
 * - İzin reddedilirse hata gösterir
 * - Kapalı/desteklenmeyen tarayıcıda buton gizlenir
 */
export function NearestCityButton({
  onResolve,
  className = "",
  variant = "full",
}: NearestCityButtonProps) {
  const [loading, setLoading] = useState(false);

  if (typeof navigator !== "undefined" && !navigator.geolocation) {
    return null;
  }

  function handleClick() {
    if (loading) return;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const closest = findClosestCity(pos.coords.latitude, pos.coords.longitude);
        setLoading(false);
        if (!closest) {
          toast.error("Konum tespit edilemedi");
          return;
        }
        // Hatırla: cookie + localStorage
        try {
          localStorage.setItem("meydanfest.location.resolvedCity", closest.city);
          document.cookie = `meydanfest_city=${encodeURIComponent(closest.city)}; path=/; max-age=31536000; samesite=lax`;
        } catch {
          // ignore
        }
        onResolve(closest.city);
        toast.success(
          `📍 ${closest.city} seçildi (${Math.round(closest.distanceKm)} km uzakta)`,
        );
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Konum izni gerekli. Tarayıcı ayarlarından ver.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast.error("Konumun şu an alınamıyor");
        } else if (err.code === err.TIMEOUT) {
          toast.error("Konum zaman aşımı");
        } else {
          toast.error("Konum alınamadı");
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="Konumumu kullan"
        className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${className}`}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <MapPin className="size-3.5" />
        )}
        Yakınımdaki
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-2 w-full rounded-xl border border-[var(--primary)]/40 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 hover:from-[var(--primary)]/15 hover:to-[var(--accent)]/15 px-3 py-2.5 text-sm font-medium text-[var(--primary)] transition-all disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin shrink-0" />
      ) : (
        <MapPin className="size-4 shrink-0" />
      )}
      <span className="flex-1 text-start">
        {loading ? "Konum alınıyor..." : "📍 Yakınımdaki şehir"}
      </span>
    </button>
  );
}
