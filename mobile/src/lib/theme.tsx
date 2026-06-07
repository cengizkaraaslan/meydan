import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Aurora } from "../theme/aurora";

export type ThemeName =
  | "aurora"
  | "blue"
  | "pink"
  | "emerald"
  | "sunset"
  | "gold"
  | "mono"
  | "ocean"
  | "plum"
  | "crimson"
  | "indigo"
  | "teal"
  | "lime"
  | "fuchsia"
  | "amber"
  | "coral";

/** Görünüm modu — kullanıcının seçtiği. "system" telefonun ayarını izler. */
export type Mode = "dark" | "light" | "system";
/** Çözümlenmiş gerçek şema (system → dark/light). */
export type Scheme = "dark" | "light";
export type Gender = "male" | "female" | "other" | null;

export interface Palette {
  scheme: Scheme;
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceStrong: string;
  hairline: string;
  text: string;
  textDim: string;
  textFaint: string;
  // marka / vurgu (temaya göre değişir)
  primary: string;
  primaryGradient: readonly [string, string, string];
  primarySoft: readonly [string, string];
  // sabit yardımcı renkler (kategori çeşitliliği için)
  violet: string;
  indigo: string;
  blue: string;
  pink: string;
  cyan: string;
  gold: string;
  success: string;
  // koyu vual / scrim — fotoğraf üstü okunabilirlik (mode'a göre değişir)
  scrim: string;
}

/** Tüm temalarda ortak kalan canlı yardımcı renkler. */
const ACCENT_HELPERS = {
  violet: Aurora.violet,
  indigo: Aurora.indigo,
  blue: Aurora.blue,
  pink: Aurora.pink,
  cyan: Aurora.cyan,
  gold: Aurora.gold,
  success: Aurora.success,
};

/** Koyu şema nötr katmanları (mevcut Aurora görünümü). */
const DARK_NEUTRALS = {
  scheme: "dark" as Scheme,
  bg: Aurora.bg,
  bgElevated: Aurora.bgElevated,
  surface: "rgba(255,255,255,0.04)",
  surfaceStrong: "rgba(255,255,255,0.08)",
  hairline: "rgba(255,255,255,0.10)",
  text: Aurora.text,
  textDim: Aurora.textDim,
  textFaint: Aurora.textFaint,
  scrim: "rgba(8,7,13,0.55)",
};

/** Açık şema nötr katmanları — yumuşak lavanta-beyaz zemin, koyu metin. */
const LIGHT_NEUTRALS = {
  scheme: "light" as Scheme,
  bg: "#F6F5FB",
  bgElevated: "#FFFFFF",
  surface: "rgba(17,15,28,0.04)",
  surfaceStrong: "rgba(17,15,28,0.07)",
  hairline: "rgba(17,15,28,0.12)",
  text: "#16141F",
  textDim: "#54506A",
  textFaint: "#8E88A4",
  scrim: "rgba(20,16,36,0.28)",
};

interface Accent {
  primary: string;
  primaryGradient: readonly [string, string, string];
  primarySoft: readonly [string, string];
}

/** Sadece marka rengini tanımlayan temalar — nötr katmanlardan bağımsız (her iki şemada da çalışır). */
export const ACCENTS: Record<ThemeName, Accent> = {
  aurora: { primary: "#A855F7", primaryGradient: ["#7C3AED", "#3B82F6", "#EC4899"], primarySoft: ["#8B5CF6", "#3B82F6"] },
  blue: { primary: "#3B82F6", primaryGradient: ["#60A5FA", "#3B82F6", "#1D4ED8"], primarySoft: ["#3B82F6", "#1D4ED8"] },
  pink: { primary: "#EC4899", primaryGradient: ["#F472B6", "#EC4899", "#A855F7"], primarySoft: ["#EC4899", "#A855F7"] },
  emerald: { primary: "#10B981", primaryGradient: ["#34D399", "#10B981", "#059669"], primarySoft: ["#34D399", "#059669"] },
  sunset: { primary: "#FB7185", primaryGradient: ["#FBBF24", "#FB7185", "#F43F5E"], primarySoft: ["#FB923C", "#F43F5E"] },
  gold: { primary: "#F5C24B", primaryGradient: ["#FDE68A", "#F5C24B", "#D97706"], primarySoft: ["#F5C24B", "#D97706"] },
  mono: { primary: "#A1A1AA", primaryGradient: ["#E4E4E7", "#A1A1AA", "#52525B"], primarySoft: ["#D4D4D8", "#71717A"] },
  ocean: { primary: "#06B6D4", primaryGradient: ["#22D3EE", "#06B6D4", "#0E7490"], primarySoft: ["#22D3EE", "#0891B2"] },
  plum: { primary: "#9333EA", primaryGradient: ["#C084FC", "#9333EA", "#6B21A8"], primarySoft: ["#A855F7", "#7E22CE"] },
  crimson: { primary: "#EF4444", primaryGradient: ["#FB7185", "#EF4444", "#B91C1C"], primarySoft: ["#F87171", "#DC2626"] },
  indigo: { primary: "#6366F1", primaryGradient: ["#818CF8", "#6366F1", "#4338CA"], primarySoft: ["#818CF8", "#4F46E5"] },
  teal: { primary: "#14B8A6", primaryGradient: ["#2DD4BF", "#14B8A6", "#0F766E"], primarySoft: ["#2DD4BF", "#0D9488"] },
  lime: { primary: "#84CC16", primaryGradient: ["#A3E635", "#84CC16", "#4D7C0F"], primarySoft: ["#A3E635", "#65A30D"] },
  fuchsia: { primary: "#D946EF", primaryGradient: ["#E879F9", "#D946EF", "#A21CAF"], primarySoft: ["#E879F9", "#C026D3"] },
  amber: { primary: "#F59E0B", primaryGradient: ["#FCD34D", "#F59E0B", "#B45309"], primarySoft: ["#FBBF24", "#D97706"] },
  coral: { primary: "#FF6B6B", primaryGradient: ["#FF9F9F", "#FF6B6B", "#E03131"], primarySoft: ["#FF8787", "#FA5252"] },
};

export const THEME_NAMES: ThemeName[] = Object.keys(ACCENTS) as ThemeName[];
export const MODES: Mode[] = ["dark", "light", "system"];

/** Şema + tema adından tam paleti üretir. */
export function buildPalette(scheme: Scheme, name: ThemeName): Palette {
  const neutrals = scheme === "light" ? LIGHT_NEUTRALS : DARK_NEUTRALS;
  return { ...neutrals, ...ACCENT_HELPERS, ...ACCENTS[name] };
}

/**
 * Geriye dönük uyumluluk + tema önizleme kartları için: koyu şemadaki tam paletler.
 * (Önizleme yalnızca primary/primaryGradient kullanır; şemadan bağımsızdır.)
 */
export const PALETTES: Record<ThemeName, Palette> = THEME_NAMES.reduce((acc, n) => {
  acc[n] = buildPalette("dark", n);
  return acc;
}, {} as Record<ThemeName, Palette>);

export function themeForGender(g: Gender): ThemeName {
  if (g === "male") return "blue";
  if (g === "female") return "pink";
  return "aurora";
}

interface ThemeState {
  t: Palette;
  name: ThemeName;
  mode: Mode;
  scheme: Scheme;
  gender: Gender;
  ready: boolean;
  setTheme: (n: ThemeName) => void;
  setMode: (m: Mode) => void;
  setGender: (g: Gender) => void;
}

const KEY_THEME = "meydanfest:theme";
const KEY_MODE = "meydanfest:mode";
const KEY_GENDER = "meydanfest:gender";

function isMode(v: unknown): v is Mode {
  return v === "dark" || v === "light" || v === "system";
}

const ThemeCtx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>("aurora");
  const [mode, setModeState] = useState<Mode>("dark");
  const [gender, setGenderState] = useState<Gender>(null);
  const [ready, setReady] = useState(false);

  // Telefonun açık/koyu ayarı — "system" modunda izlenir, değişince otomatik günceller.
  const systemScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedMode, savedGender] = await Promise.all([
          AsyncStorage.getItem(KEY_THEME),
          AsyncStorage.getItem(KEY_MODE),
          AsyncStorage.getItem(KEY_GENDER),
        ]);
        const g = (savedGender as Gender) ?? null;
        setGenderState(g);
        if (isMode(savedMode)) setModeState(savedMode);
        if (savedTheme) setName(savedTheme as ThemeName);
        else if (g) setName(themeForGender(g)); // tema seçilmemişse cinsiyetten varsayılan
      } catch {
        /* yok say */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const scheme: Scheme = mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  const t = useMemo(() => buildPalette(scheme, name), [scheme, name]);

  const setTheme = useCallback((n: ThemeName) => {
    setName(n);
    AsyncStorage.setItem(KEY_THEME, n);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY_MODE, m);
  }, []);

  const setGender = useCallback((g: Gender) => {
    setGenderState(g);
    if (g) AsyncStorage.setItem(KEY_GENDER, g);
    else AsyncStorage.removeItem(KEY_GENDER);
  }, []);

  return (
    <ThemeCtx.Provider value={{ t, name, mode, scheme, gender, ready, setTheme, setMode, setGender }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
