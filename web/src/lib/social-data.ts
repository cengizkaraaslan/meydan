export type Gender = "M" | "F";

/** Email'den profil slug'ı (local-part, küçük harf, alfanümerik). /profil/[username] anahtarı. */
export function profileSlugFromEmail(email: string): string {
  return (email || "")
    .split("@")[0]
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9_-]/g, "");
}

export interface PublicUser {
  username: string;
  name: string;
  bio: string;
  color: string;
  followers: number;
  following: number;
  events: number;
  igLinked: boolean;
  gender: Gender;
  /** Avatar fotoğraf URL'si (cinsiyete uygun) */
  avatarUrl: string;
  /** Şehir — profil sayfasında "📍 İstanbul" olarak görünür */
  city?: string;
  /** Hobiler — chip olarak gösterilir, profilde "🎸 Müzik · 📷 Fotoğraf" gibi */
  hobbies?: string[];
  /** ISO YYYY-MM-DD — yaş hesabı bundan yapılır */
  birthDate?: string;
}

/** ISO doğum tarihinden yaş hesapla */
export function calcAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}

/**
 * Unsplash'tan curated edilmiş gerçek kişi portre fotoğrafları.
 * Lisans: Unsplash License (telif serbest, ticari kullanım dahil).
 * Cinsiyete uygun ayrı listeler.
 */
const FEMALE_PORTRAITS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1593104547489-5cfb3839a3b5?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1521252659862-eec69941b071?w=400&h=400&fit=crop&crop=faces&auto=format",
];
const MALE_PORTRAITS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces&auto=format",
  "https://images.unsplash.com/photo-1545996124-0501ebae84d0?w=400&h=400&fit=crop&crop=faces&auto=format",
];

function avatarFor(gender: Gender, seed: number): string {
  const pool = gender === "F" ? FEMALE_PORTRAITS : MALE_PORTRAITS;
  return pool[Math.abs(seed) % pool.length];
}

export const MOCK_USERS: PublicUser[] = [
  { username: "ahmet",  name: "Ahmet Karaca",  bio: "Konser ve festival meraklısı 🎸",            color: "#7c3aed", followers: 1284, following: 312, events: 47, igLinked: true,  gender: "M", avatarUrl: avatarFor("M", 32), city: "İstanbul",  birthDate: "1996-04-18", hobbies: ["Rock konseri", "Plak", "Gitar"] },
  { username: "elif",   name: "Elif Şen",       bio: "İstanbul'da yeni kalkışlar 🌆",              color: "#f59e0b", followers: 892,  following: 145, events: 31, igLinked: true,  gender: "F", avatarUrl: avatarFor("F", 44), city: "İstanbul",  birthDate: "1998-09-03", hobbies: ["Festival", "Fotoğraf", "Yoga"] },
  { username: "burak",  name: "Burak Demir",    bio: "Stand-up + jazz ❤️",                          color: "#10b981", followers: 567,  following: 203, events: 22, igLinked: false, gender: "M", avatarUrl: avatarFor("M", 51), city: "Ankara",    birthDate: "1993-11-22", hobbies: ["Stand-up", "Jazz", "Sinema"] },
  { username: "zeynep", name: "Zeynep Taş",     bio: "Tiyatro tutkunu",                            color: "#ef4444", followers: 1843, following: 89,  events: 64, igLinked: true,  gender: "F", avatarUrl: avatarFor("F", 68), city: "İstanbul",  birthDate: "1990-02-14", hobbies: ["Tiyatro", "Opera", "Kitap"] },
  { username: "mert",   name: "Mert Yılmaz",    bio: "Spor + Galatasaray",                         color: "#06b6d4", followers: 2104, following: 510, events: 38, igLinked: false, gender: "M", avatarUrl: avatarFor("M", 12), city: "İstanbul",  birthDate: "1994-07-30", hobbies: ["Futbol", "Spor", "Galatasaray"] },
  { username: "selin",  name: "Selin Acar",     bio: "Müzik etkinlikleri ve festivaller",          color: "#ec4899", followers: 678,  following: 234, events: 19, igLinked: true,  gender: "F", avatarUrl: avatarFor("F", 21), city: "Eskişehir", birthDate: "1999-05-12", hobbies: ["Festival", "DJ", "Dans"] },
  { username: "can",    name: "Can Berk",       bio: "Underground konserler 🎧",                    color: "#8b5cf6", followers: 412,  following: 167, events: 15, igLinked: false, gender: "M", avatarUrl: avatarFor("M", 76), city: "İzmir",     birthDate: "1997-01-08", hobbies: ["Indie", "Vinyl", "Sahaf"] },
  { username: "deniz",  name: "Deniz Murat",    bio: "Tiyatro & sergi",                            color: "#14b8a6", followers: 989,  following: 421, events: 52, igLinked: true,  gender: "M", avatarUrl: avatarFor("M", 88), city: "Bursa",     birthDate: "1991-10-27", hobbies: ["Tiyatro", "Sergi", "Müze"] },
  { username: "naz",    name: "Naz Aydın",      bio: "Festival fan 🎪",                            color: "#a855f7", followers: 1567, following: 198, events: 41, igLinked: true,  gender: "F", avatarUrl: avatarFor("F", 33), city: "Antalya",   birthDate: "1995-08-19", hobbies: ["Festival", "Doğa", "Kamp"] },
  { username: "ege",    name: "Ege Kara",       bio: "İzmir bazlı",                                color: "#0ea5e9", followers: 234,  following: 89,  events: 8,  igLinked: false, gender: "M", avatarUrl: avatarFor("M", 17), city: "İzmir",     birthDate: "2000-12-04", hobbies: ["Sörf", "Bisiklet"] },
  { username: "yusuf",  name: "Yusuf Aslan",    bio: "Spor + dövüş sanatları",                     color: "#f97316", followers: 743,  following: 156, events: 27, igLinked: true,  gender: "M", avatarUrl: avatarFor("M", 64), city: "Ankara",    birthDate: "1992-06-09", hobbies: ["MMA", "Koşu", "Crossfit"] },
  { username: "duru",   name: "Duru Kaya",      bio: "Çocuk etkinlikleri + atölyeler 👶",           color: "#84cc16", followers: 1102, following: 312, events: 35, igLinked: false, gender: "F", avatarUrl: avatarFor("F", 55), city: "İstanbul",  birthDate: "1989-03-25", hobbies: ["Atölye", "Çocuk", "El sanatı"] },
];

const SEED_LIKES: Record<string, number[]> = {
  e1: [0, 1, 2, 3, 4, 5, 8, 10],
  e2: [1, 3, 5, 7, 9, 11],
  e3: [0, 2, 4, 6, 8, 10, 11],
  e4: [4, 10, 11],
  e5: [3, 7, 9],
  e6: [0, 1, 5, 8],
  e7: [11, 7, 3],
  e8: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  e9: [7, 3],
  e10: [4, 8, 10],
  e11: [4, 10],
  e12: [11, 7],
};

export function seedLikersFor(eventId: string): PublicUser[] {
  return (SEED_LIKES[eventId] ?? []).map((i) => MOCK_USERS[i]).filter(Boolean);
}

export function seedLikeCount(eventId: string): number {
  const base = SEED_LIKES[eventId]?.length ?? 0;
  return base + Math.floor(Math.abs(hashCode(eventId)) % 89);
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return h;
}

export function findUserByUsername(username: string): PublicUser | undefined {
  return MOCK_USERS.find((u) => u.username === username.toLowerCase());
}

/** Türkçe isimden cinsiyet tahmini — fake data'da kullanılır */
const FEMALE_PATTERNS = [
  /^(ay[şs]e|elif|zeynep|selin|naz|duru|ece|deniz|merve|gül|emine|hatice|fatma|esra|seda|nilay|büşra|yağmur|asya|ela|defne|ipek|melisa|melike|özge|sevgi|sibel|şehnaz|aslı|berrak|büşra|burcu|cansu|ceren|damla|derya|dilan|ebru|esma|funda|gamze|gizem|hande|irem|leyla|lale|mervenur|nuray|nurhan|özlem|pelin|pinar|rabia|rana|reyhan|saliha|seda|selma|seval|sevcan|sevda|sevinç|sıla|sinem|tülay|tuğba|yasemin|yıldız|zümra)\b/i,
];
export function inferGender(name: string): Gender {
  const firstName = name.trim().split(/\s+/)[0].toLowerCase();
  for (const p of FEMALE_PATTERNS) {
    if (p.test(firstName)) return "F";
  }
  return "M";
}

/** Cinsiyete uygun avatar URL'i — buddy-seed gibi runtime üretilen mock'lar için */
export function avatarUrlFor(name: string, seed?: number): string {
  const gender = inferGender(name);
  const s = seed ?? Math.abs(hashCode(name)) % 99;
  return avatarFor(gender, s);
}
