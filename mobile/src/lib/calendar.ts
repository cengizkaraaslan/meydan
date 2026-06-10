import { Alert, Linking } from "react-native";
import * as Calendar from "expo-calendar";
import { API_BASE, type ApiEvent } from "./api";

/**
 * "Takvime ekle" — CİHAZIN KENDİ takvimine kaydeder (Google web değil).
 * expo-calendar `createEventInCalendarAsync` ile işletim sisteminin native takvim
 * editörünü önceden doldurulmuş olarak açar; kullanıcı "Kaydet"e dokununca etkinlik
 * telefonun varsayılan takvim uygulamasına (Google Takvim app / Samsung Takvim vb.)
 * eklenir. Bu yöntem takvim izni GEREKTİRMEZ (sistem UI'ı üzerinden).
 * Native modül bir nedenle yoksa web .ics indirme bağlantısına düşer.
 */

/** Etkinliğin başlangıç/bitişi (bitiş yoksa +2 saat). Geçersiz tarihte null. */
function eventRange(event: ApiEvent): { start: Date; end: Date } | null {
  const startMs = Date.parse(event.starts_at);
  if (Number.isNaN(startMs)) return null;
  const start = new Date(startMs);
  const endMs = event.ends_at ? Date.parse(event.ends_at) : NaN;
  const end = !Number.isNaN(endMs) ? new Date(endMs) : new Date(startMs + 2 * 60 * 60 * 1000);
  return { start, end };
}

export async function addEventToCalendar(event: ApiEvent): Promise<void> {
  const range = eventRange(event);
  if (!range) {
    Alert.alert("Takvime ekle", "Etkinlik tarihi okunamadı.");
    return;
  }
  const where = [event.venue, event.city, event.country].filter(Boolean).join(", ");
  const notes = [event.description ?? "", `${API_BASE}/etkinlik/${event.slug}`]
    .filter(Boolean)
    .join("\n\n");

  try {
    // Native sistem takvim editörünü aç (cihazın kendi takvimine kaydeder).
    await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate: range.start,
      endDate: range.end,
      location: where,
      notes,
    });
    return;
  } catch {
    // Native modül/diyalog kullanılamazsa web .ics'e düş (cihaz takvim uygulamasında açılır).
  }
  try {
    await Linking.openURL(`${API_BASE}/api/etkinlik/${event.slug}/ics`);
  } catch {
    Alert.alert("Takvime ekle", "Takvim uygulaması açılamadı. Lütfen tekrar deneyin.");
  }
}
