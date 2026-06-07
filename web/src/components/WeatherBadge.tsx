"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface WeatherBadgeProps {
  /** Etkinlik tarihi. */
  date: Date | string;
  /** Şehir adı (key olarak slug'lanır). */
  city: string;
  /** Daha küçük variant — sadece ikon + sıcaklık. */
  compact?: boolean;
  className?: string;
}

/** Deterministic 32-bit hash — string FNV-1a benzeri, mock data seed'i için. */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface WeatherSample {
  emoji: string;
  tempC: number;
  condition: string;
  hint?: string;
}

/** Hava koşulu havuzu — emoji + Türkçe açıklama + opsiyonel öneri. */
const CONDITIONS: WeatherSample[] = [
  { emoji: "☀️",  tempC: 0, condition: "güneşli",            hint: "güneşlik gerekebilir" },
  { emoji: "🌤️",  tempC: 0, condition: "parçalı bulutlu",    },
  { emoji: "⛅",  tempC: 0, condition: "az bulutlu",          },
  { emoji: "☁️",  tempC: 0, condition: "bulutlu",            },
  { emoji: "🌦️",  tempC: 0, condition: "sağanak yağışlı",    hint: "şemsiye getir" },
  { emoji: "🌧️",  tempC: 0, condition: "yağmurlu",           hint: "şemsiye getir" },
  { emoji: "⛈️",  tempC: 0, condition: "fırtınalı",          hint: "ıslanma!" },
  { emoji: "🌨️",  tempC: 0, condition: "karlı",              hint: "kalın giyin" },
  { emoji: "🌫️",  tempC: 0, condition: "sisli",              },
  { emoji: "💨",  tempC: 0, condition: "rüzgârlı",            },
];

/** Mevsimsel sıcaklık aralığı — ay (0-11) bazlı yaklaşık TR ortalaması. */
const MONTHLY_TEMP_BASE: Array<[number, number]> = [
  [4, 10],   // Ocak
  [5, 12],   // Şubat
  [9, 16],   // Mart
  [13, 21],  // Nisan
  [17, 25],  // Mayıs
  [22, 30],  // Haziran
  [25, 33],  // Temmuz
  [25, 33],  // Ağustos
  [21, 28],  // Eylül
  [15, 22],  // Ekim
  [9, 16],   // Kasım
  [5, 11],   // Aralık
];

/** Türkçe slug — minimal (sadece harf eşitlemesi). */
function citySlug(city: string): string {
  return city
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Etkinlik tarihi + şehir → deterministic mock hava.
 * Aynı (gün, şehir) çifti her zaman aynı sıcaklığı + koşulu verir.
 */
function computeWeather(date: Date, city: string): WeatherSample & { tempC: number } {
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const seed = hashSeed(`${dateKey}|${citySlug(city)}`);

  // Koşul seçimi
  const condIdx = seed % CONDITIONS.length;
  const base = CONDITIONS[condIdx];

  // Sıcaklık: aylık tabandan ±3°C jitter
  const [lo, hi] = MONTHLY_TEMP_BASE[date.getMonth()];
  const range = hi - lo;
  const jitter = ((seed >>> 5) % (range + 1));
  const temp = lo + jitter;

  return { ...base, tempC: temp };
}

export function WeatherBadge({ date, city, compact, className }: WeatherBadgeProps) {
  const d = typeof date === "string" ? new Date(date) : date;

  const data = useMemo(() => {
    // Sadece etkinlik tarihi 7 gün içindeyse hesapla — değilse null döndür.
    const now = new Date();
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < -1 || diffDays > 7) return null;
    return computeWeather(d, city);
  }, [d, city]);

  if (!data) return null;

  if (compact) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className={`inline-flex items-center gap-1 rounded-full bg-[var(--card)]/90 backdrop-blur px-2 py-0.5 text-[11px] font-medium border border-[var(--border)] ${className ?? ""}`}
        title={`${data.condition} • ${data.tempC}°C`}
      >
        <span aria-hidden>{data.emoji}</span>
        <span className="tabular-nums">{data.tempC}°C</span>
      </motion.span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 backdrop-blur px-2.5 py-1 text-xs font-medium border border-[var(--border)] ${className ?? ""}`}
      title={`Tahmini hava — ${data.condition}`}
    >
      <span aria-hidden className="text-base leading-none">{data.emoji}</span>
      <span className="tabular-nums font-semibold">{data.tempC}°C</span>
      {data.hint ? (
        <span className="text-[var(--muted)] hidden sm:inline">• {data.hint}</span>
      ) : (
        <span className="text-[var(--muted)] hidden sm:inline">• {data.condition}</span>
      )}
    </motion.div>
  );
}
