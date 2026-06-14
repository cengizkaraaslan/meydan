const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export function parseDate(iso: string): Date {
  return new Date(iso);
}

export function fmtDay(iso: string): { day: string; month: string; weekday: string } {
  const d = new Date(iso);
  return { day: String(d.getDate()), month: MONTHS[d.getMonth()], weekday: DAYS[d.getDay()] };
}

export function fmtLong(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()} · ${time}`;
}

export function fmtShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtPrice(e: { is_free: boolean; price_min: number | null; price_max: number | null }): string {
  if (e.is_free) return "Ücretsiz";
  if (e.price_min == null) return "Biletli";
  if (e.price_max && e.price_max !== e.price_min) return `${e.price_min}–${e.price_max}₺`;
  return `${e.price_min}₺`;
}

// Üniversite etkinlikleri: biletli/ücretli değil, öğrenciye açık.
const UNIVERSITY_SOURCES = new Set(["ANADOLU_UNI", "BILKENT", "ITU", "BOGAZICI"]);

/** Kaynak bir üniversite etkinliği mi? (UNI_* veya bilinen üniv. kaynakları) */
export function isUniversitySource(source?: string | null): boolean {
  if (!source) return false;
  return source.startsWith("UNI_") || UNIVERSITY_SOURCES.has(source);
}

/**
 * Başlık bir şenlik/festival/şölen/panayır/kermes mi? Bu tür etkinlikler kategorisi yanlış
 * atanmış olsa bile (örn. "Geleneksel Tepreş Şenliği" DIGER gelirse) fiyat yoksa ücretsizdir;
 * scraper'da fiyat bulunamadı diye "Biletli" damgalanmasınlar. Konser/tiyatro vb. etkilenmez.
 */
const FESTIVAL_TITLE = /(şenlik|senlik|şenliğ|senliğ|şölen|solen|festival|\bfest\b|panayır|panayir|kermes)/i;

/**
 * Etkinlik için doğru erişim/fiyat etiketi. Üniversite kaynağı ise "Ücretsiz/Biletli"
 * yerine "🎓 Öğrenciye açık" döner (hatalı "Ücretsiz" gösterimini engeller).
 */
export function priceLabel(e: {
  source?: string | null;
  category?: string | null;
  title?: string | null;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
}): string {
  if (isUniversitySource(e.source)) return "🎓 Öğrenciye açık";
  // Festival/şenlik vb.: fiyat bilgisi yoksa "Biletli" deme — fiyat yazmıyorsa ücretsizdir.
  if (!e.is_free && e.price_min == null && (e.category === "FESTIVAL" || FESTIVAL_TITLE.test(e.title ?? ""))) {
    return "Ücretsiz";
  }
  return fmtPrice(e);
}

/**
 * Etiketle TUTARLI renk için: etkinlik gerçekten biletli mi? priceLabel "Ücretsiz" ya da
 * "🎓 Öğrenciye açık" döndürüyorsa biletli değildir (renk yeşil/cyan olmalı, gold değil).
 */
export function isTicketedLabel(e: {
  source?: string | null;
  category?: string | null;
  title?: string | null;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
}): boolean {
  const l = priceLabel(e);
  return l !== "Ücretsiz" && !l.startsWith("🎓");
}

/** Mesafe metni: <1km ise metre ("400 m"), değilse km (gerekirse tek ondalık). */
export function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const rounded = Math.round(km * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
}

/** Gün filtresi için yerel tarih aralığı (ISO). "all" → boş. */
export function dayRange(day: "all" | "today" | "tomorrow" | "weekend"): { from?: string; to?: string } {
  if (day === "weekend") return weekendRange();
  if (day === "all") return {};
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (day === "tomorrow") start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setHours(23, 59, 59, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Bu hafta sonu (Cmt+Paz) aralığı ISO olarak. */
export function weekendRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0 Paz ... 6 Cmt
  const sat = new Date(now);
  sat.setDate(now.getDate() + ((6 - day + 7) % 7));
  sat.setHours(0, 0, 0, 0);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  sun.setHours(23, 59, 59, 0);
  return { from: sat.toISOString(), to: sun.toISOString() };
}

/** "Bugün" / "Yarın" / "Bu hafta sonu" göreli etiketi; uymuyorsa null (normal tarih gösterilir). */
export function relativeDayLabel(iso: string): string | null {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((sod(d) - sod(now)) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  const wd = d.getDay(); // 0 Paz, 6 Cmt
  if ((wd === 6 || wd === 0) && diff >= 0 && diff <= 7) return "Bu hafta sonu";
  return null;
}

/** Etkinlik günü bugünden önce mi (geçmiş)? */
export function isPastDay(iso: string): boolean {
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return sod(d) < sod(now);
}
