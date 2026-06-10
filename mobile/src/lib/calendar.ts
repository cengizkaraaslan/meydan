import { Alert, Platform } from "react-native";
import * as Calendar from "expo-calendar";
import { API_BASE, type ApiEvent } from "./api";

/**
 * "Takvime ekle" — etkinliği CİHAZIN KENDİ takvimine ekler. Web'e/`.ics` indirmeye
 * YÖNLENDİRME YAPMAZ.
 *
 * 1) Önce native sistem takvim editörünü açar (`createEventInCalendarAsync`): alanlar
 *    önceden doldurulur, kullanıcı "Kaydet"e dokununca etkinlik telefonun varsayılan
 *    takvim uygulamasına (Google/Samsung Takvim vb.) eklenir.
 * 2) Sistem editörü kullanılamazsa, takvim izni isteyip etkinliği yazılabilir bir
 *    takvime DOĞRUDAN ekler (`createEventAsync`) ve onay verir.
 *
 * Not: Native takvim modülü/izinleri için app.json'a expo-calendar config plugin'i
 * eklidir; değişiklik sonrası lokal (gradlew) yeniden derleme gerekir.
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

/** Cihazın saat dilimi (alınamazsa undefined → expo-calendar varsayılanı kullanır). */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Doğrudan eklemek için yazılabilir bir takvim id'si bul. */
async function writableCalendarId(): Promise<string | null> {
  if (Platform.OS === "ios") {
    const def = await Calendar.getDefaultCalendarAsync().catch(() => null);
    if (def?.id) return def.id;
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = cals.filter((c) => c.allowsModifications);
  // Tercih: birincil/sahip olunan takvim, yoksa ilk yazılabilir.
  const primary =
    writable.find((c) => (c as { isPrimary?: boolean }).isPrimary) ??
    writable.find((c) => c.accessLevel === Calendar.CalendarAccessLevel.OWNER) ??
    writable[0];
  return primary?.id ?? null;
}

export async function addEventToCalendar(event: ApiEvent): Promise<void> {
  const range = eventRange(event);
  if (!range) {
    Alert.alert("Takvime ekle", "Etkinlik tarihi okunamadı.");
    return;
  }
  const location = [event.venue, event.city, event.country].filter(Boolean).join(", ");
  const notes = [event.description ?? "", `${API_BASE}/etkinlik/${event.slug}`]
    .filter(Boolean)
    .join("\n\n");

  const base = {
    title: event.title,
    startDate: range.start,
    endDate: range.end,
    location,
    notes,
    timeZone: deviceTimeZone(),
  };

  // 1) Native sistem takvim editörü (cihazın kendi takvimine kaydeder, izin gerektirmez).
  try {
    const res = await Calendar.createEventInCalendarAsync(base);
    // Kullanıcı vazgeçtiyse sessizce çık; aksi halde başarı.
    if (res?.action === Calendar.CalendarDialogResultActions.canceled) return;
    return;
  } catch {
    // Editör kullanılamadı → doğrudan eklemeye düş.
  }

  // 2) İzin iste ve etkinliği doğrudan cihaz takvimine ekle.
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Takvim izni gerekli",
        "Etkinliği takvimine eklemek için Ayarlar'dan takvim iznini açman gerekiyor.",
      );
      return;
    }
    const calId = await writableCalendarId();
    if (!calId) {
      Alert.alert("Takvime ekle", "Telefonunda yazılabilir bir takvim bulunamadı.");
      return;
    }
    await Calendar.createEventAsync(calId, base);
    Alert.alert("Takvime eklendi", `"${event.title}" telefonunun takvimine eklendi.`);
  } catch {
    Alert.alert("Takvime ekle", "Etkinlik takvime eklenemedi. Lütfen tekrar dene.");
  }
}
