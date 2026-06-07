/**
 * Hafta sonu / şehir bazlı "birlikte çıkabileceğin" buddy önerileri.
 *
 * Aynı (city, count) çağrısı her zaman aynı sıralamayı verir — FNV-1a hash
 * tabanlı deterministic skor. Mesaj at butonu /mesaj/<username> sayfasına gider.
 */

import { avatarUrlFor, inferGender, type Gender } from "./social-data";

export interface Buddy {
  username: string;
  name: string;
  color: string;
  bio: string;
  gender: Gender;
  avatarUrl: string;
}

interface BuddyBase {
  username: string;
  name: string;
  color: string;
  bio: string;
}

/** Sabit havuz: 30 Türkçe isim. Username küçük harf + ASCII. */
const POOL_BASE: BuddyBase[] = [
  { username: "selin",   name: "Selin K.",   color: "#ec4899", bio: "Müzik & festival" },
  { username: "deniz",   name: "Deniz A.",   color: "#14b8a6", bio: "Tiyatro tutkunu" },
  { username: "ahmet",   name: "Ahmet Y.",   color: "#7c3aed", bio: "Konser meraklısı" },
  { username: "elif",    name: "Elif Ş.",    color: "#f59e0b", bio: "Şehir keşifleri" },
  { username: "burak",   name: "Burak D.",   color: "#10b981", bio: "Stand-up + jazz" },
  { username: "zeynep",  name: "Zeynep T.",  color: "#ef4444", bio: "Sanat & sergi" },
  { username: "mert",    name: "Mert Y.",    color: "#06b6d4", bio: "Spor severim" },
  { username: "can",     name: "Can B.",     color: "#8b5cf6", bio: "Underground konserler" },
  { username: "naz",     name: "Naz A.",     color: "#a855f7", bio: "Festival fanı" },
  { username: "ege",     name: "Ege K.",     color: "#0ea5e9", bio: "Ege bazlı keşifçi" },
  { username: "yusuf",   name: "Yusuf A.",   color: "#f97316", bio: "Spor + dövüş sanatları" },
  { username: "duru",    name: "Duru K.",    color: "#84cc16", bio: "Atölye ve workshop" },
  { username: "kaan",    name: "Kaan O.",    color: "#dc2626", bio: "Rock konserleri" },
  { username: "ipek",    name: "İpek M.",    color: "#db2777", bio: "Tiyatro + opera" },
  { username: "berk",    name: "Berk C.",    color: "#2563eb", bio: "Caz festivalleri" },
  { username: "nehir",   name: "Nehir P.",   color: "#16a34a", bio: "Sergi gezgini" },
  { username: "tuna",    name: "Tuna R.",    color: "#9333ea", bio: "Elektronik müzik" },
  { username: "lara",    name: "Lara H.",    color: "#ea580c", bio: "Klasik müzik" },
  { username: "doruk",   name: "Doruk E.",   color: "#0891b2", bio: "Outdoor & koşu" },
  { username: "asya",    name: "Asya G.",    color: "#be185d", bio: "Şarkı söyler, gitar çalar" },
  { username: "emre",    name: "Emre B.",    color: "#65a30d", bio: "Stand-up severim" },
  { username: "bade",    name: "Bade M.",    color: "#7c2d12", bio: "Film festivalleri" },
  { username: "ozan",    name: "Ozan T.",    color: "#1d4ed8", bio: "Indie konserler" },
  { username: "melis",   name: "Melis Ç.",   color: "#c026d3", bio: "Sokak sanatı" },
  { username: "atlas",   name: "Atlas D.",   color: "#15803d", bio: "Kamp + müzik" },
  { username: "rüya",    name: "Rüya O.",    color: "#b91c1c", bio: "Tiyatro yazarı" },
  { username: "umut",    name: "Umut S.",    color: "#0369a1", bio: "DJ + gece etkinlikleri" },
  { username: "irem",    name: "İrem U.",    color: "#9f1239", bio: "Modern dans" },
  { username: "kerem",   name: "Kerem L.",   color: "#1e40af", bio: "Hard rock fanı" },
  { username: "mira",    name: "Mira V.",    color: "#a16207", bio: "Şehir festivalleri" },
];

/** Avatar + cinsiyet enjeksiyonu (deterministik isim -> seed) */
const POOL: Buddy[] = POOL_BASE.map((b, idx) => ({
  ...b,
  gender: inferGender(b.name),
  avatarUrl: avatarUrlFor(b.name, (idx * 7 + 13) % 99),
}));

/** FNV-1a 32-bit hash — BuddyMatchmaker'daki pattern ile uyumlu deterministic seed. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Şehir için deterministic buddy önerileri döner.
 * Aynı `city`/`count` çağrısı her zaman aynı buddy sıralamasını verir.
 */
export function getWeekendBuddies(city: string, count = 3): Buddy[] {
  const seedKey = `weekend::${city.toLocaleLowerCase("tr")}`;
  return POOL
    .map((b) => ({
      buddy: b,
      score: fnv1a(`${seedKey}::${b.username}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count))
    .map((s) => s.buddy);
}

export const BUDDY_POOL = POOL;
