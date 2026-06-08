/**
 * Belediye ÜCRETSİZ KURS hattı — EtkinlikScout public API (/api/v1/courses).
 * Veri web tarafında gerçek scrape (ESMEK/KOMEK/GASMEK/İZMEK/KAYMEK).
 * Görselsiz branş listeleri → app'te gradient + emoji ile canlandırılır.
 */
import Constants from "expo-constants";
import { API_BASE } from "./api";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiKey?: string };
const API_KEY = extra.apiKey ?? "meydanfest-app";

/** Bir belediye kurs sağlayıcısı (web CourseProvider'ın app'te gereken alanları). */
export interface CourseProvider {
  key: string;
  name: string;
  city: string;
  /** Branş/kurs listesinin bulunduğu belediye sayfası */
  listUrl?: string;
  /** Kullanıcının ön kayıt/başvuru yapacağı belediye sayfası */
  registerUrl?: string;
}

/** Tek bir kurs/branş kaydı (web CourseItem ile uyumlu). */
export interface Course {
  name: string;
  center?: string;
  schedule?: string;
  image?: string;
  full?: boolean;
  open?: boolean;
}

/** Bir belediyenin branş grubu. */
export interface CourseGroup {
  provider: CourseProvider;
  courses: Course[];
}

interface CoursesResponse {
  ok?: boolean;
  data?: CourseGroup[];
}

/**
 * Ücretsiz kurs gruplarını çeker. city verilirse o şehre süzülür (backend Türkçe-duyarsız).
 * Hata/boş → [].
 */
export async function fetchCourseGroups(city?: string): Promise<CourseGroup[]> {
  try {
    const url = new URL(`${API_BASE}/api/v1/courses`);
    if (city) url.searchParams.set("city", city);
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": API_KEY, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as CoursesResponse;
    const list = json.data ?? [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Kurs adından konuya göre emoji tahmini (görselsiz branşları canlandırmak için). */
export function courseEmoji(name: string): string {
  const n = name.toLocaleLowerCase("tr");
  const has = (...keys: string[]) => keys.some((k) => n.includes(k));
  if (has("resim", "çizim", "cizim", "ebru", "minyatür", "minyatur", "tezhip", "boya")) return "🎨";
  if (has("tiyatro", "drama", "sahne", "oyuncu")) return "🎭";
  if (has("müzik", "muzik", "gitar", "piyano", "bağlama", "baglama", "keman", "ney", "şan", "san", "ud", "korosu")) return "🎵";
  if (has("bilişim", "bilisim", "bilgisayar", "yazılım", "yazilim", "kod", "ofis", "web", "dijital")) return "💻";
  if (has("örgü", "orgu", "dikiş", "dikis", "nakış", "nakis", "tekstil", "moda", "el sanat", "iğne", "igne", "kumaş", "kumas")) return "🧶";
  if (has("ahşap", "ahsap", "marangoz")) return "🪵";
  if (has("yemek", "aşçı", "asci", "pasta", "mutfak", "pastacı", "pastaci", "hamur")) return "👨‍🍳";
  if (has("ingilizce", "almanca", "arapça", "arapca", "dil ", "fransızca", "fransizca", "ispanyolca", "rusça", "rusca", "diksiyon")) return "🗣️";
  if (has("spor", "fitness", "yoga", "pilates", "dans", "halk oyun", "zumba")) return "🤸";
  if (has("foto", "kamera", "sinema", "film", "video")) return "📷";
  if (has("seramik", "çini", "cini", "çömlek", "comlek", "kil")) return "🏺";
  if (has("hat", "kaligrafi", "kalligrafi")) return "✒️";
  if (has("matemat", "sınav", "sinav", "lgs", "yks", "tyt", "ders")) return "📚";
  if (has("kuaför", "kuafor", "güzellik", "guzellik", "saç", "sac", "makyaj", "estetik")) return "💇";
  if (has("takı", "taki", "mücevher", "mucevher", "kuyum")) return "💍";
  if (has("çocuk", "cocuk")) return "🧸";
  if (has("girişim", "girisim", "muhasebe", "ticaret", "pazarlama", "satış", "satis")) return "📈";
  return "🎓";
}
