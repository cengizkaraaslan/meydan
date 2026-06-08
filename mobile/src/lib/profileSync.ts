import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./api";
import type { Gender } from "./theme";

/**
 * Cihaz kimliği + profil senkronu. MeydanFest'in gerçek hesap backend'i yok;
 * cinsiyet/şehir/dil cihazda tutulur ve EtkinlikScout API'sine (deviceId ile)
 * best-effort gönderilir (/api/v1/profile). Hata sessizce yutulur.
 */
const KEY_DEVICE = "meydanfest:deviceId";

function rndId(): string {
  // Math.random burada güvenli (uygulama runtime'ı).
  return "mf_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEY_DEVICE);
  if (!id) {
    id = rndId();
    await AsyncStorage.setItem(KEY_DEVICE, id);
  }
  return id;
}

export async function syncProfile(data: {
  gender?: Gender;
  city?: string | null;
  district?: string | null;
  lang?: string;
  avatar?: string | null;
  name?: string;
  lat?: number;
  lng?: number;
}): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await fetch(`${API_BASE}/api/v1/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
      body: JSON.stringify({ deviceId, ...data }),
    });
  } catch {
    /* best-effort */
  }
}
