import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/** Tanışma/profil bilgileri (yerelde saklanır; backend'e de senkron edilir). */
export interface DProfile {
  about: string;
  birthDate: string; // "YYYY-MM-DD" (boş olabilir)
  age: string; // basit yaş girişi (2 hane); birthDate boşken kullanılır
  showAge: boolean;
  heightCm: string;
  weightKg: string;
  interests: string[];
  goal: string | null;
  languages: string[];
  zodiac: string | null;
  education: string | null;
  drinking: string | null;
  smoking: string | null;
  exercise: string | null;
}

export const DEFAULT_DPROFILE: DProfile = {
  about: "",
  birthDate: "",
  age: "",
  showAge: true,
  heightCm: "",
  weightKg: "",
  interests: [],
  goal: "Etkinlik arkadaşı", // varsayılan ilişki hedefi (kayıt olurken)
  languages: [],
  zodiac: null,
  education: null,
  drinking: null,
  smoking: null,
  exercise: null,
};

/** Telefon diline göre varsayılan "bildiğim dil" etiketi. */
export function deviceLanguageLabel(): string {
  try {
    const loc = (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().locale) || "tr";
    const p = loc.slice(0, 2).toLowerCase();
    const map: Record<string, string> = {
      tr: "Türkçe", en: "İngilizce", de: "Almanca", fr: "Fransızca",
      es: "İspanyolca", it: "İtalyanca", ar: "Arapça", ru: "Rusça",
    };
    return map[p] ?? "Türkçe";
  } catch {
    return "Türkçe";
  }
}

/** Doğum tarihinden ("YYYY-MM-DD") burç hesaplar; geçersizse null. */
export function zodiacFromBirthDate(birthDate: string): string | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const day = d.getDate();
  const m = d.getMonth() + 1;
  const within = (m1: number, d1: number, m2: number, d2: number) =>
    (m === m1 && day >= d1) || (m === m2 && day <= d2);
  if (within(3, 21, 4, 19)) return "Koç";
  if (within(4, 20, 5, 20)) return "Boğa";
  if (within(5, 21, 6, 20)) return "İkizler";
  if (within(6, 21, 7, 22)) return "Yengeç";
  if (within(7, 23, 8, 22)) return "Aslan";
  if (within(8, 23, 9, 22)) return "Başak";
  if (within(9, 23, 10, 22)) return "Terazi";
  if (within(10, 23, 11, 21)) return "Akrep";
  if (within(11, 22, 12, 21)) return "Yay";
  if (within(12, 22, 1, 19)) return "Oğlak";
  if (within(1, 20, 2, 18)) return "Kova";
  return "Balık"; // 2/19 - 3/20
}

// Seçenek listeleri (etiketler Türkçe; chip değeri = etiket).
export const INTERESTS = [
  "Film", "Dizi", "Oyun", "Konser", "Tiyatro", "Müzik", "Spor", "Seyahat",
  "Kitap", "Yemek", "Dans", "Sanat", "Fotoğraf", "Doğa", "Kahve", "Festival",
  "Stand-up", "Teknoloji",
];
export const GOALS = ["Uzun ilişki", "Kısa süreli", "Etkinlik arkadaşı", "Arkadaşlık", "Henüz emin değilim"];
export const LANGS = ["Türkçe", "İngilizce", "Almanca", "Fransızca", "İspanyolca", "İtalyanca", "Arapça", "Rusça"];
export const ZODIACS = ["Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak", "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"];
export const EDUCATION = ["Lise", "Ön lisans", "Üniversite", "Yüksek lisans", "Doktora"];
export const DRINKING = ["Hiç", "Sosyal içerim", "Sık sık"];
export const SMOKING = ["Hayır", "Bazen", "Evet"];
export const EXERCISE = ["Hiç", "Bazen", "Düzenli", "Her gün"];

const KEY = "meydanfest:dprofile";

// Modül-içi cache + dinleyiciler (ekranlar arası senkron için).
let cache: DProfile = DEFAULT_DPROFILE;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      cache = { ...DEFAULT_DPROFILE, ...(JSON.parse(raw) as Partial<DProfile>) };
    } else {
      // Yeni kullanıcı: bildiğim dil telefon diline göre, ilişki hedefi varsayılan.
      cache = { ...DEFAULT_DPROFILE, languages: [deviceLanguageLabel()] };
      AsyncStorage.setItem(KEY, JSON.stringify(cache));
    }
  } catch {
    /* yoksay */
  }
  loaded = true;
  notify();
}

function persist(next: DProfile) {
  cache = next;
  AsyncStorage.setItem(KEY, JSON.stringify(next));
  notify();
}

/** "YYYY-MM-DD" doğum tarihinden yaş hesaplar; geçersizse null. */
export function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Reaktif profil bilgisi: yükler, kısmi günceller, anında kaydeder. */
export function useDProfile() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    void ensureLoaded();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const update = useCallback((patch: Partial<DProfile>) => {
    persist({ ...cache, ...patch });
  }, []);

  const toggleIn = useCallback((field: "interests" | "languages", value: string) => {
    const cur = cache[field];
    const nextArr = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    persist({ ...cache, [field]: nextArr });
  }, []);

  return { profile: cache, update, toggleIn };
}

/**
 * Başkalarının yaşını görebilir miyim? KURAL (karşılıklı): kendi yaşını gizleyen
 * (showAge=false) kullanıcı, başkalarının da yaşını GÖREMEZ. showAge=true → görebilir.
 */
export function useCanSeeAges(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    void ensureLoaded();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return cache.showAge;
}
