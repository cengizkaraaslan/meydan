import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { PEOPLE } from "./people";
import { fmtDistance } from "./format";

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
