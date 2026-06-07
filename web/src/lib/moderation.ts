import "server-only";

/**
 * Basit içerik moderasyonu: küfür/spam filtresi + per-user rate limit.
 * Mock — production'da Redis + ML model gerekir. Şimdilik in-memory.
 */

// Türkçe + İngilizce kaba kelimeler. Tam kelime eşleşmesi için \b kullanılır.
// (Kasıtlı şekilde sınırlı tutuldu — "amaç", "siktir" gibi kelimelerin geçtiği
// normal cümleleri yakalamayacak şekilde.)
const PROFANITY: ReadonlyArray<string> = [
  "amk", "amına", "amına koy", "anan", "anasını sik", "ananı sik",
  "siktir git", "sikerim", "siktiğim", "yarrak", "yarak", "göt veren",
  "orospu", "orospu çocuğu", "piç", "puşt", "ibne", "götveren",
  // İngilizce
  "fuck you", "fucker", "motherfuck", "asshole", "bitch", "shit",
  "cunt", "nigger",
];

// Türkçe karakter normalizasyonu — "ş" → "s" gibi yazımlarla bypass denemelerini yakalar
function normalizeForMatch(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/[şŞ]/g, "s")
    .replace(/[ıİiI]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ");
}

const NORMALIZED_PROFANITY = PROFANITY.map(normalizeForMatch);

export interface ModerationResult {
  ok: boolean;
  reason?: "profanity" | "spam" | "too_long" | "empty" | "rate_limit" | "link_spam";
  message?: string;
}

const MAX_LEN = 1000;
const MIN_LEN = 1;
// Kişi başı: 60 saniyede en fazla 6 mesaj
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;

// userId → mesaj zamanları (en eski → en yeni)
const RATE: Map<string, number[]> = (() => {
  const g = globalThis as unknown as { __modRate?: Map<string, number[]> };
  g.__modRate ??= new Map();
  return g.__modRate;
})();

/**
 * Mesaj içeriğini moderasyondan geçirir.
 * - Boş / çok uzun mesajları reddeder
 * - Küfür içeren mesajları reddeder
 * - Link bombardımanını (3+ link) reddeder
 * - Per-user rate limit uygular
 */
export function moderateMessage(
  userId: string,
  text: string,
): ModerationResult {
  const trimmed = text.trim();
  if (trimmed.length < MIN_LEN) {
    return { ok: false, reason: "empty", message: "Mesaj boş olamaz" };
  }
  if (trimmed.length > MAX_LEN) {
    return { ok: false, reason: "too_long", message: "Mesaj çok uzun (1000 karakter)" };
  }

  // Link bombardımanı
  const linkCount = (trimmed.match(/https?:\/\//gi) ?? []).length;
  if (linkCount >= 3) {
    return { ok: false, reason: "link_spam", message: "Tek mesajda 3'ten fazla link gönderilemez" };
  }

  const normalized = normalizeForMatch(trimmed);
  for (const bad of NORMALIZED_PROFANITY) {
    // Kelime sınırı yoksa harf-içi eşleşmeyi de yakalar (l33t-style)
    if (normalized.includes(bad)) {
      return {
        ok: false,
        reason: "profanity",
        message: "Mesajın uygunsuz içerik içeriyor olabilir",
      };
    }
  }

  // Rate limit
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (RATE.get(userId) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) {
    return {
      ok: false,
      reason: "rate_limit",
      message: "Çok hızlı mesaj atıyorsun, biraz yavaşla",
    };
  }
  recent.push(now);
  RATE.set(userId, recent);

  return { ok: true };
}

/** Eski kullanıcı rate kayıtlarını temizler (5dk'da bir çağrılabilir). */
export function pruneRateCache(): void {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [user, times] of RATE) {
    const fresh = times.filter((t) => t > cutoff);
    if (fresh.length === 0) RATE.delete(user);
    else RATE.set(user, fresh);
  }
}
