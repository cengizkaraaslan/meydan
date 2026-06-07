/**
 * Open-Meteo (anahtarsız) ile etkinlik günü hava tahmini.
 *
 * - Geocode: open-meteo geocoding API ile şehir → lat/lon.
 *   (başarısız olursa yerel `city-geo.ts` tablosuna düşer)
 * - Forecast: günlük weather_code + max/min sıcaklık.
 * - Etkinlik >16 gün ileride veya geçmişteyse → null (tahmin yok).
 * - Tüm ağ hataları yutulur → null. Sayfa hava durumu olmadan render olur.
 *
 * Server-side fetch; Next revalidate ile önbelleklenir.
 */

import { getCityLatLng } from "@/lib/city-geo";

export interface EventWeather {
  /** WMO koşuluna karşılık gelen emoji. */
  emoji: string;
  /** Türkçe koşul etiketi (ör. "Az bulutlu"). */
  label: string;
  /** Günlük en yüksek sıcaklık (°C, yuvarlanmış). */
  tempMax: number;
  /** Günlük en düşük sıcaklık (°C, yuvarlanmış). */
  tempMin: number;
}

/** WMO weather code → emoji + Türkçe etiket. */
function wmoToInfo(code: number): { emoji: string; label: string } {
  // https://open-meteo.com/en/docs (WMO Weather interpretation codes)
  switch (code) {
    case 0:
      return { emoji: "☀️", label: "Açık" };
    case 1:
      return { emoji: "🌤️", label: "Çoğunlukla açık" };
    case 2:
      return { emoji: "⛅", label: "Parçalı bulutlu" };
    case 3:
      return { emoji: "☁️", label: "Bulutlu" };
    case 45:
    case 48:
      return { emoji: "🌫️", label: "Sisli" };
    case 51:
    case 53:
    case 55:
      return { emoji: "🌦️", label: "Çisenti" };
    case 56:
    case 57:
      return { emoji: "🌧️", label: "Dondurucu çisenti" };
    case 61:
    case 63:
    case 65:
      return { emoji: "🌧️", label: "Yağmurlu" };
    case 66:
    case 67:
      return { emoji: "🌧️", label: "Dondurucu yağmur" };
    case 71:
    case 73:
    case 75:
      return { emoji: "🌨️", label: "Karlı" };
    case 77:
      return { emoji: "🌨️", label: "Kar taneleri" };
    case 80:
    case 81:
    case 82:
      return { emoji: "🌦️", label: "Sağanak" };
    case 85:
    case 86:
      return { emoji: "🌨️", label: "Kar sağanağı" };
    case 95:
      return { emoji: "⛈️", label: "Gök gürültülü" };
    case 96:
    case 99:
      return { emoji: "⛈️", label: "Dolu fırtınası" };
    default:
      return { emoji: "🌡️", label: "Hava durumu" };
  }
}

/** `Date` → "YYYY-MM-DD" (yerel/forecast timezone=auto ile uyumlu). */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Open-Meteo geocoding → {lat, lon}; başarısızsa yerel tablodan dener. */
async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city,
    )}&count=1&language=tr&format=json`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
    if (res.ok) {
      const data = (await res.json()) as {
        results?: Array<{ latitude: number; longitude: number }>;
      };
      const hit = data.results?.[0];
      if (hit && typeof hit.latitude === "number" && typeof hit.longitude === "number") {
        return { lat: hit.latitude, lon: hit.longitude };
      }
    }
  } catch {
    // geçer — yerel tabloya düş
  }
  // Fallback: 81 il yerel koordinat tablosu.
  const local = getCityLatLng(city);
  if (local) return { lat: local.lat, lon: local.lng };
  return null;
}

/**
 * Etkinliğin gerçekleşeceği gün için hava tahmini döndürür.
 * @param city Şehir adı (TR).
 * @param dateISO Etkinlik tarihi — ISO string veya `Date`.
 * @returns `EventWeather` veya tahmin yoksa/hata olursa `null`.
 */
export async function getEventWeather(
  city: string,
  dateISO: string | Date,
): Promise<EventWeather | null> {
  try {
    if (!city) return null;
    const date = typeof dateISO === "string" ? new Date(dateISO) : dateISO;
    if (Number.isNaN(date.getTime())) return null;

    // Tahmin penceresi: bugünden -1 .. +16 gün. Dışıysa tahmin yok.
    const now = new Date();
    const diffDays = (date.getTime() - now.getTime()) / 86_400_000;
    if (diffDays < -1 || diffDays > 16) return null;

    const geo = await geocode(city);
    if (!geo) return null;

    const ymd = toYMD(date);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto` +
      `&start_date=${ymd}&end_date=${ymd}`;

    const res = await fetch(url, { next: { revalidate: 60 * 60 * 3 } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      daily?: {
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
      };
    };

    const code = data.daily?.weather_code?.[0];
    const max = data.daily?.temperature_2m_max?.[0];
    const min = data.daily?.temperature_2m_min?.[0];
    if (typeof code !== "number" || typeof max !== "number" || typeof min !== "number") {
      return null;
    }

    const { emoji, label } = wmoToInfo(code);
    return {
      emoji,
      label,
      tempMax: Math.round(max),
      tempMin: Math.round(min),
    };
  } catch {
    return null;
  }
}
