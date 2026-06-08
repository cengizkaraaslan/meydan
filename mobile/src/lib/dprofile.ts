import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/** Tanışma/profil bilgileri (yerelde saklanır; ileride backend'e senkron edilebilir). */
export interface DProfile {
  about: string;
  age: string;
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
  age: "",
  showAge: true,
  heightCm: "",
  weightKg: "",
  interests: [],
  goal: null,
  languages: [],
  zodiac: null,
  education: null,
  drinking: null,
  smoking: null,
  exercise: null,
};

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

/** Reaktif profil bilgisi: yükler, kısmi güncelleme yapar, anında kaydeder. */
export function useDProfile() {
  const [profile, setProfile] = useState<DProfile>(DEFAULT_DPROFILE);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!raw) return;
      try {
        setProfile({ ...DEFAULT_DPROFILE, ...(JSON.parse(raw) as Partial<DProfile>) });
      } catch {
        /* yoksay */
      }
    });
  }, []);

  const update = useCallback((patch: Partial<DProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** Çoklu-seçim alanında bir değeri aç/kapat. */
  const toggleIn = useCallback(
    (field: "interests" | "languages", value: string) => {
      setProfile((prev) => {
        const cur = prev[field];
        const has = cur.includes(value);
        const nextArr = has ? cur.filter((v) => v !== value) : [...cur, value];
        const next = { ...prev, [field]: nextArr };
        AsyncStorage.setItem(KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  return { profile, update, toggleIn };
}
