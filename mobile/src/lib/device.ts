import AsyncStorage from "@react-native-async-storage/async-storage";

// Cihaz kimliği için AsyncStorage anahtarı (kurulum başına stabil).
const KEY = "meydanfest_device_id";

// Math.random tabanlı basit UUID v4 üretici.
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cached: string | null = null;

/** Cihaz kimliğini döndürür (yoksa üretip kaydeder). Kurulum boyunca sabit. */
export async function getOrCreateDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const fresh = uuidv4();
    await AsyncStorage.setItem(KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    cached = uuidv4();
    return cached;
  }
}
