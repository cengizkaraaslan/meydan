import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { ApiEvent } from "./api";

/**
 * Etkinlik hatırlatıcıları — CİHAZDA planlanan yerel bildirimler (sunucu push gerekmez,
 * offline çalışır). RSVP "Ben de"/"Belki" denince etkinlikten 1 GÜN ve 1 SAAT önce
 * bildirim planlanır; vazgeçilince iptal edilir. Planlanan bildirim ID'leri eventId ile
 * eşlenip saklanır (iptal edebilmek için).
 */

const KEY = "meydanfest:reminders:v1"; // { [eventId]: string[] (scheduled notification ids) }
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

async function readMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

async function writeMap(m: Record<string, string[]>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // sessizce yut
  }
}

/** Hatırlatıcı bildirim kanalını hazırla (Android). best-effort. */
async function ensureChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Etkinlik hatırlatıcıları",
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch {
    // iOS/web — kanal yok, sorun değil
  }
}

/** Bu etkinliğin planlı hatırlatıcılarını iptal et. */
export async function cancelEventReminders(eventId: string): Promise<void> {
  const m = await readMap();
  const ids = m[eventId];
  if (ids && ids.length) {
    for (const id of ids) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // zaten gitmişse yut
      }
    }
  }
  if (m[eventId]) {
    delete m[eventId];
    await writeMap(m);
  }
}

/**
 * Etkinlik için hatırlatıcıları (yeniden) planla. Önce eskileri iptal eder.
 * Yalnız GELECEKTEKİ tetik zamanları planlanır (geçmiş anlar atlanır).
 * Bildirim izni initNotifications() ile zaten istenmiş olmalı.
 */
export async function scheduleEventReminders(event: ApiEvent): Promise<void> {
  try {
    await cancelEventReminders(event.id);
    const startMs = Date.parse(event.starts_at);
    if (Number.isNaN(startMs)) return;
    const now = Date.now();
    // Etkinlik zaten başladıysa/geçtiyse planlama yapma.
    if (startMs <= now + 5 * 60 * 1000) return;

    await ensureChannel();

    const where = event.city ? ` · ${event.city}` : "";
    const plans: { fireAt: number; title: string; body: string }[] = [
      {
        fireAt: startMs - DAY_MS,
        title: `⏰ Yarın: ${event.title}`,
        body: `Yarın katılacağın etkinlik${where}. Hazır mısın? 🎉`,
      },
      {
        fireAt: startMs - HOUR_MS,
        title: `⏰ 1 saat sonra: ${event.title}`,
        body: `Etkinlik birazdan başlıyor${where}. Yola çıkma vakti! 🚀`,
      },
    ];

    const scheduledIds: string[] = [];
    for (const p of plans) {
      if (p.fireAt <= now + 60 * 1000) continue; // geçmiş/çok yakın → atla
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: p.title, body: p.body, data: { eventId: event.id } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(p.fireAt),
            channelId: "reminders",
          },
        });
        scheduledIds.push(id);
      } catch {
        // tek bildirim planlanamazsa diğerini dene
      }
    }

    if (scheduledIds.length) {
      const m = await readMap();
      m[event.id] = scheduledIds;
      await writeMap(m);
    }
  } catch {
    // planlama tümüyle başarısızsa sessizce yut — hatırlatıcı best-effort
  }
}
