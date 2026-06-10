import { Alert, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { API_BASE, type ApiEvent } from "./api";

/**
 * "Takvime ekle" — yeni native modül (expo-calendar) GEREKTİRMEZ.
 * Birincil yol: Google Takvim "şablon" URL'i → Android'de Google Takvim'i önceden
 * doldurulmuş etkinlikle açar, kullanıcı yalnız "Kaydet"e dokunur. Google Takvim yoksa
 * tarayıcıda web takvimi açılır. Yedek: web'deki .ics indirme endpoint'i.
 */

/** ISO tarihi Google Takvim/ICS biçimine çevir: YYYYMMDDTHHMMSSZ (UTC). */
function toCalDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** Etkinliğin başlangıç/bitişi (bitiş yoksa +2 saat). Geçersiz tarihte null. */
function eventRange(event: ApiEvent): { start: Date; end: Date } | null {
  const startMs = Date.parse(event.starts_at);
  if (Number.isNaN(startMs)) return null;
  const start = new Date(startMs);
  const endMs = event.ends_at ? Date.parse(event.ends_at) : NaN;
  const end = !Number.isNaN(endMs) ? new Date(endMs) : new Date(startMs + 2 * 60 * 60 * 1000);
  return { start, end };
}

/** Google Takvim şablon URL'i (önceden doldurulmuş etkinlik). */
function googleCalendarUrl(event: ApiEvent): string | null {
  const range = eventRange(event);
  if (!range) return null;
  const dates = `${toCalDate(range.start)}/${toCalDate(range.end)}`;
  const where = [event.venue, event.city, event.country].filter(Boolean).join(", ");
  const detailParts = [event.description ?? "", `${API_BASE}/etkinlik/${event.slug}`].filter(Boolean);
  const sp = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: detailParts.join("\n\n"),
    location: where,
  });
  return `https://calendar.google.com/calendar/render?${sp.toString()}`;
}

/**
 * Etkinliği takvime ekle. Önce Google Takvim şablonunu açmayı dener (tarayıcı/Google
 * Takvim uygulaması); o başarısız olursa web .ics indirme bağlantısına düşer.
 */
export async function addEventToCalendar(event: ApiEvent): Promise<void> {
  const gcal = googleCalendarUrl(event);
  if (gcal) {
    try {
      await WebBrowser.openBrowserAsync(gcal);
      return;
    } catch {
      // tarayıcı açılamadıysa .ics'e düş
    }
  }
  const ics = `${API_BASE}/api/etkinlik/${event.slug}/ics`;
  try {
    await Linking.openURL(ics);
  } catch {
    Alert.alert("Takvime ekle", "Takvim uygulaması açılamadı. Lütfen tekrar deneyin.");
  }
}
