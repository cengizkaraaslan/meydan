import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(min?: number | null, max?: number | null, isFree?: boolean): string {
  if (isFree) return "Ücretsiz";
  // Ücretli ama fiyat verisi yok → yanıltıcı "Fiyat bilgisi yok" yerine net "Biletli".
  // (Çoğu biletleme sitesi fiyatı liste sayfasında vermez; karta tıklayınca bilet sayfası açılır.)
  if (min == null && max == null) return "🎟️ Biletli";
  if (min != null && max != null && min !== max) {
    return `${min.toLocaleString("tr-TR")} – ${max.toLocaleString("tr-TR")} ₺`;
  }
  const value = min ?? max ?? 0;
  if (value === 0) return "🎟️ Biletli";
  return `${value.toLocaleString("tr-TR")} ₺`;
}

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/**
 * Tarih parçalarını SABİT Europe/Istanbul saatinde çıkarır. Böylece sunucu (UTC) ve
 * tarayıcı (kullanıcının TZ'si) AYNI çıktıyı üretir → hydration mismatch (#418) olmaz.
 * Eskiden getDate()/getHours() (yerel TZ) kullanılıyordu; UTC vs UTC+3 farkı gece
 * sınırındaki etkinliklerde gün/saat uyuşmazlığı + interaktiflik bozulmasına yol açıyordu.
 */
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function istanbulParts(d: Date): { day: number; monthIndex: number; weekdayIndex: number; hours: string; minutes: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hh = get("hour") === "24" ? "00" : get("hour"); // bazı motorlar gece yarısı "24" döndürür
  return {
    day: Number(get("day")),
    monthIndex: Number(get("month")) - 1,
    weekdayIndex: WD_INDEX[get("weekday")] ?? 0,
    hours: hh.padStart(2, "0"),
    minutes: get("minute").padStart(2, "0"),
  };
}

export function formatEventDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const { day, monthIndex, weekdayIndex, hours, minutes } = istanbulParts(d);
  return `${day} ${TR_MONTHS[monthIndex]} ${TR_DAYS[weekdayIndex]} • ${hours}:${minutes}`;
}

export function formatShortDate(date: Date | string): { day: string; month: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  const { day, monthIndex } = istanbulParts(d);
  return {
    day: String(day).padStart(2, "0"),
    month: TR_MONTHS[monthIndex].slice(0, 3).toUpperCase(),
  };
}

export function slugify(text: string): string {
  const trMap: Record<string, string> = {
    ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g",
    ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c",
  };
  return text
    .split("")
    .map((c) => trMap[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Türkçe yer hali (locative case) eki üretir.
 *
 * Kurallar:
 * - Son ünlü: a, ı, o, u → -da / sert ünsüzden sonra -ta
 * - Son ünlü: e, i, ö, ü → -de / sert ünsüzden sonra -te
 * - Sert ünsüzler: ç, f, h, k, p, s, ş, t
 *
 * Örnek: cityLocative("İstanbul") → "İstanbul'da"
 *        cityLocative("Eskişehir") → "Eskişehir'de"
 *        cityLocative("Sinop") → "Sinop'ta"
 *        cityLocative("Tekirdağ") → "Tekirdağ'da"
 *        cityLocative("Kayseri") → "Kayseri'de"
 *        cityLocative("Konya") → "Konya'da"
 */
export function cityLocative(city: string): string {
  if (!city) return city;
  const trimmed = city.trim();
  // Son ünlüyü bul
  const VOWELS = new Set("aeıioöuüAEIİOÖUÜ");
  const HARD_CONSONANTS = new Set("çfhkpsştÇFHKPSŞT");
  let lastVowel = "";
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i];
    if (VOWELS.has(ch)) {
      lastVowel = ch.toLocaleLowerCase("tr");
      break;
    }
  }
  // a, ı, o, u → "da"; e, i, ö, ü → "de"
  const isBack = ["a", "ı", "o", "u"].includes(lastVowel);
  // Son harf sert ünsüz mü?
  const lastChar = trimmed[trimmed.length - 1];
  const isHardConsonant = HARD_CONSONANTS.has(lastChar);
  let suffix: string;
  if (isHardConsonant) {
    suffix = isBack ? "ta" : "te";
  } else {
    suffix = isBack ? "da" : "de";
  }
  return `${trimmed}'${suffix}`;
}

/** "Eskişehir'deki", "İstanbul'daki" gibi sıfat formu */
export function cityLocativeKi(city: string): string {
  return cityLocative(city) + "ki";
}
