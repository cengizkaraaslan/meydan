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

const KEY_AVATAR = "meydanfest:avatar";

// Girişli kullanıcıda profil ANAHTARI = email ("acct:<email>"). Profil (avatar dahil)
// HESABA bağlanır → reinstall'da deviceId sıfırlansa bile korunur. Girişsizken cihaz id.
let accountKey: string | null = null;
export function setAccountKey(email: string | null): void {
  const e = email?.trim().toLowerCase();
  accountKey = e ? `acct:${e}` : null;
}
async function getProfileKey(): Promise<string> {
  return accountKey ?? (await getDeviceId());
}

// Avatar geri-yükleme bildirimi (login sonrası ekranlar canlı güncellensin).
type AvatarListener = (url: string) => void;
const avatarListeners = new Set<AvatarListener>();
export function onAvatarRestored(l: AvatarListener): () => void {
  avatarListeners.add(l);
  return () => {
    avatarListeners.delete(l);
  };
}

/** Sunucudaki profili (account key ile) çeker. */
export async function fetchProfile(): Promise<Record<string, unknown> | null> {
  try {
    const key = await getProfileKey();
    const res = await fetch(`${API_BASE}/api/v1/profile?deviceId=${encodeURIComponent(key)}`, {
      headers: { "x-api-key": "meydanfest-app", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; profile?: Record<string, unknown> | null };
    return json.profile ?? null;
  } catch {
    return null;
  }
}

/** Girişten sonra: sunucudaki avatar'ı yerele geri yükle (reinstall sonrası kaybolmasın). */
export async function restoreAvatar(): Promise<void> {
  const prof = await fetchProfile();
  const avatar = prof && typeof prof.avatar === "string" ? prof.avatar.trim() : "";
  if (avatar) {
    await AsyncStorage.setItem(KEY_AVATAR, avatar);
    avatarListeners.forEach((l) => l(avatar));
  }
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
  // Tanışma profili alanları (backend MobileProfile'a yazılır)
  bio?: string; // "Hakkımda"
  birthDate?: string | null;
  showAge?: boolean;
  heightCm?: string;
  weightKg?: string;
  interests?: string; // virgülle ayrık
  goal?: string | null;
  languages?: string; // virgülle ayrık
  zodiac?: string | null;
  education?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  exercise?: string | null;
}): Promise<void> {
  try {
    const deviceId = await getProfileKey();
    await fetch(`${API_BASE}/api/v1/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
      body: JSON.stringify({ deviceId, ...data }),
    });
  } catch {
    /* best-effort */
  }
}
