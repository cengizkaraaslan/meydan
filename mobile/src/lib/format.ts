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

/** Mesafe metni: <1km ise metre ("400 m"), değilse km (gerekirse tek ondalık). */
export function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const rounded = Math.round(km * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
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
