import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Bir kişinin fotoğrafı yoksa gösterilecek DEFAULT avatar GÖRSEL URL'i üretir.
 * ui-avatars.com ile baş harf(ler)ten gerçek bir resim döner; arka plan rengi cinsiyete göre.
 */
export function defaultAvatar(name?: string | null, gender?: string | null): string {
  // Baş harf(ler): "Ada Lovelace" → "AL", "Ada" → "A", boş → "MF".
  const clean = (name ?? "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  let initials = "MF";
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[1][0]).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0].slice(0, 2).toUpperCase();
  }

  // Cinsiyete göre arka plan rengi.
  const g = (gender ?? "").trim().toLowerCase();
  const bg = g === "male" ? "6366F1" : g === "female" ? "EC4899" : "A855F7";

  const q = encodeURIComponent(initials);
  return `https://ui-avatars.com/api/?name=${q}&size=256&bold=true&color=fff&background=${bg}`;
}

/**
 * Bir görsel URL'ini React Native Image'in yükleyebileceği biçime çevirir.
 * - Google Drive PAYLAŞIM linki (.../file/d/<ID>/view, open?id=<ID>, uc?id=<ID>) → doğrudan
 *   görsel linki (lh3.googleusercontent.com/d/<ID>). Aksi halde RN sayfayı yükleyemez, resim çıkmaz.
 * - Diğer http(s) (bize/R2'ye yüklenen, Google hesap fotosu) → aynen.
 */
export function normalizeImageUrl(url?: string | null): string | null {
  const u = url?.trim();
  if (!u) return null;
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=[^&]+&)?id=)([\w-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  return u;
}

/**
 * Foto doluysa onu (Google Drive linki normalize edilerek), değilse cinsiyete göre default görsel.
 * 3 durum: (1) Google Drive linki → dönüştürülür, (2) bize/R2 yüklenen http → aynen, (3) yok → default.
 */
export function resolveAvatar(photo?: string | null, name?: string | null, gender?: string | null): string {
  const p = normalizeImageUrl(photo);
  return p ? p : defaultAvatar(name, gender);
}

/** Kayıtlı cinsiyeti okur (AsyncStorage "meydanfest:gender"). */
export async function readGender(): Promise<string | null> {
  return AsyncStorage.getItem("meydanfest:gender");
}
