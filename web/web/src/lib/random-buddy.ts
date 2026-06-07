/**
 * "Sürpriz biriyle eşleş" — kullanıcının baloncuğunu kıran random buddy önerisi.
 *
 * - Havuz: BUDDY_POOL (30) ∪ MOCK_USERS — username'e göre dedupe.
 * - Deterministik: aynı (seed, city, gender, exclude) → aynı sonuç (mock'ta kararlı UX).
 * - Compatibility skoru ve "ortak ilgi" chip'leri pseudo-random ama tutarlı.
 *
 * BuddyMatchmaker'daki FNV-1a + skor-sırala paterniyle uyumlu.
 */

import { BUDDY_POOL, type Buddy } from "./buddy-seed";
import { MOCK_USERS } from "./social-data";

export interface RandomBuddyProfile {
  username: string;
  name: string;
  avatarUrl: string;
  color: string;
  bio: string;
  gender: "M" | "F";
  /** Tahmini şehir — fake distribution. */
  city?: string;
  /** UI flair için 60-99 arası pseudo-random uyum yüzdesi. */
  compatScore: number;
  /** Bio'dan türetilmiş 2-3 ortak ilgi chip'i. */
  sharedInterests: string[];
  /** Yeşil online dot için. */
  mockOnline: boolean;
}

export interface PickRandomBuddyOptions {
  city?: string;
  genderPreference?: "M" | "F" | "any";
  /** Aynı session içinde aynı sıralamayı vermek için sabit seed (default: 1). */
  seed?: number;
  /** Önceden gösterilen username'ler (yenilemede tekrar görünmesin). */
  exclude?: string[];
}

/** FNV-1a 32-bit hash — buddy-seed.ts ile aynı pattern. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Cinsiyete uygun, deterministik fake şehir dağılımı. */
const FAKE_CITIES = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Eskişehir",
  "Konya",
  "Adana",
  "Gaziantep",
  "Trabzon",
];

/** Bio anahtar kelimelerinden 2-3 ortak ilgi türetir. */
function deriveSharedInterests(bio: string, seedNum: number): string[] {
  const b = bio.toLocaleLowerCase("tr");
  const tags: string[] = [];
  if (b.includes("konser") || b.includes("müzik") || b.includes("rock") || b.includes("jazz") || b.includes("dj") || b.includes("indie") || b.includes("elektronik") || b.includes("klasik")) tags.push("Konser");
  if (b.includes("festival")) tags.push("Festival");
  if (b.includes("tiyatro") || b.includes("opera")) tags.push("Tiyatro");
  if (b.includes("spor") || b.includes("galatasaray") || b.includes("dövüş") || b.includes("koşu") || b.includes("outdoor")) tags.push("Spor");
  if (b.includes("sergi") || b.includes("sanat") || b.includes("sokak sanatı")) tags.push("Sergi");
  if (b.includes("stand-up")) tags.push("Stand-Up");
  if (b.includes("atölye") || b.includes("workshop")) tags.push("Atölye");
  if (b.includes("çocuk")) tags.push("Çocuk");
  if (b.includes("sinema") || b.includes("film")) tags.push("Sinema");
  if (b.includes("dans")) tags.push("Dans");
  if (b.includes("kamp") || b.includes("keşif")) tags.push("Keşif");

  // Hiç eşleşmediyse genel etiket ekle
  if (tags.length === 0) tags.push("Etkinlik", "Sosyal");

  // Deterministik karıştırma + en fazla 3
  const sorted = tags
    .map((t, i) => ({ t, score: fnv1a(`${t}::${seedNum}::${i}`) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);

  // Tekilleştir, ilk 3
  return Array.from(new Set(sorted)).slice(0, Math.min(3, Math.max(2, sorted.length)));
}

/** BUDDY_POOL + MOCK_USERS birleşik havuzu — username'e göre dedupe. */
function unifiedPool(): Buddy[] {
  const seen = new Set<string>();
  const out: Buddy[] = [];

  for (const b of BUDDY_POOL) {
    if (seen.has(b.username)) continue;
    seen.add(b.username);
    out.push(b);
  }

  for (const u of MOCK_USERS) {
    if (seen.has(u.username)) continue;
    seen.add(u.username);
    out.push({
      username: u.username,
      name: u.name,
      color: u.color,
      bio: u.bio,
      gender: u.gender,
      avatarUrl: u.avatarUrl,
    });
  }

  return out;
}

/** Buddy → RandomBuddyProfile (deterministik flair eklenmiş). */
function enrich(buddy: Buddy, opts: PickRandomBuddyOptions): RandomBuddyProfile {
  const seedKey = `${buddy.username}::${opts.city ?? ""}`;
  const h = fnv1a(seedKey);
  const compatScore = 60 + (h % 40); // 60-99
  const cityIdx = (h >>> 4) % FAKE_CITIES.length;
  const online = ((h >>> 8) % 100) < 65; // %65 online
  return {
    username: buddy.username,
    name: buddy.name,
    avatarUrl: buddy.avatarUrl,
    color: buddy.color,
    bio: buddy.bio,
    gender: buddy.gender,
    city: opts.city ?? FAKE_CITIES[cityIdx],
    compatScore,
    sharedInterests: deriveSharedInterests(buddy.bio, h),
    mockOnline: online,
  };
}

/** Filtre + skorla → sıralı liste. */
function rankedCandidates(opts: PickRandomBuddyOptions): Buddy[] {
  const pool = unifiedPool();
  const excludeSet = new Set((opts.exclude ?? []).map((u) => u.toLowerCase()));
  const seed = opts.seed ?? 1;
  const seedKey = `random::${seed}::${(opts.city ?? "").toLocaleLowerCase("tr")}`;

  return pool
    .filter((b) => !excludeSet.has(b.username))
    .filter((b) => {
      if (!opts.genderPreference || opts.genderPreference === "any") return true;
      return b.gender === opts.genderPreference;
    })
    .map((b) => ({ b, score: fnv1a(`${seedKey}::${b.username}`) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.b);
}

/**
 * Tek bir random buddy döner. Pool boşaldıysa null.
 */
export function pickRandomBuddy(opts: PickRandomBuddyOptions): RandomBuddyProfile | null {
  const list = rankedCandidates(opts);
  if (list.length === 0) return null;
  return enrich(list[0], opts);
}

/**
 * `count` kadar deterministic sıralı buddy önerisi.
 * "Sıradaki" akışı için ardışık çağrılarda exclude prevoius username.
 */
export function pickRandomBuddies(
  count: number,
  opts: PickRandomBuddyOptions = {},
): RandomBuddyProfile[] {
  const list = rankedCandidates(opts);
  return list.slice(0, Math.max(0, count)).map((b) => enrich(b, opts));
}

/** Test / debug için: havuz boyutu. */
export function randomBuddyPoolSize(): number {
  return unifiedPool().length;
}
