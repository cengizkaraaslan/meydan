import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { PEOPLE } from "./people";
import { fmtDistance } from "./format";
import { API_BASE } from "./api";
import { getDeviceId } from "./profileSync";

/** Kullanıcının bildirim tercihleri. mode "custom" iken cities/categories boşsa = hepsi. */
export interface NotifPrefs {
  mode: "all" | "custom" | "off";
  cities: string[];
  categories: string[];
}

const NOTIF_PREFS_KEY = "meydanfest:notifprefs";
const DEFAULT_PREFS: NotifPrefs = { mode: "all", cities: [], categories: [] };

/** Kayıtlı bildirim tercihlerini oku (yoksa varsayılan: tümü açık). */
export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    return {
      mode: parsed.mode === "custom" || parsed.mode === "off" ? parsed.mode : "all",
      cities: Array.isArray(parsed.cities) ? parsed.cities : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Tercihleri yerelde sakla + best-effort backend'e ilet (deviceId ile). */
export async function setNotifPrefs(p: NotifPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p));
  } catch {
    // yerel kayıt başarısız olursa sessizce yut
  }
  try {
    const deviceId = await getDeviceId();
    await fetch(`${API_BASE}/api/v1/notify-prefs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, ...p }),
    });
  } catch {
    // backend erişilemezse sessizce yut — yerel kayıt yeterli
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Bildirim izni iste + Android kanalını hazırla (best-effort). */
export async function initNotifications(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // izin akışı başarısız olursa sessizce yut
  }
  try {
    await Notifications.setNotificationChannelAsync("nearby", {
      name: "Yakındakiler",
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch {
    // ör. iOS / web — kanal yok, sorun değil
  }
}

/** Yakındaki online bir kişi için "teaser" bildirimi planla. */
export async function scheduleNearbyTeaser(): Promise<void> {
  try {
    const online = PEOPLE.filter((p) => p.online);
    if (online.length === 0) return;

    const idx = new Date().getSeconds() % online.length;
    const p = online[idx];

    const lang = (await AsyncStorage.getItem("meydanfest:lang")) === "en" ? "en" : "tr";

    const title =
      lang === "en" ? `✨ ${p.name} is nearby!` : `✨ ${p.name} yakınında!`;
    const body =
      lang === "en"
        ? `${p.name} · ${fmtDistance(p.distanceKm)} away — check out their profile 👀`
        : `${p.name} · ${fmtDistance(p.distanceKm)} uzakta — profiline göz at 👀`;

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { personId: p.id } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 6,
        channelId: "nearby",
      },
    });
  } catch {
    // planlama başarısız olursa sessizce yut
  }
}

/** Bluetooth yakınlık — espirili yerel "30 metrede biri var" bildirimi planla. */
export async function scheduleProximityPing(name: string): Promise<void> {
  try {
    const lang = (await AsyncStorage.getItem("meydanfest:lang")) === "en" ? "en" : "tr";

    const title =
      lang === "en" ? "📡 Someone's super close!" : "📡 Çok yakında biri var!";
    const body =
      lang === "en"
        ? `${name} might be within ${fmtDistance(0.03)} — look around, don't miss it 😏`
        : `${name} ${fmtDistance(0.03)} mesafede olabilir — etrafına bak, kaçırma 😏`;

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 4,
        channelId: "nearby",
      },
    });
  } catch {
    // planlama başarısız olursa sessizce yut
  }
}

/** Bildirime dokununca ilgili kişi ekranına yönlendir. */
export function useNearbyNotificationNav(): void {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const pid = resp.notification.request.content.data?.personId;
      if (pid) router.push(`/kisi/${pid}`);
    });
    return () => sub.remove();
  }, []);
}
