import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  | "crimson";
export type Gender = "male" | "female" | "other" | null;

export interface Palette {
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
}

const BASE = {
  bg: Aurora.bg,
  bgElevated: Aurora.bgElevated,
  surface: Aurora.surface,
  surfaceStrong: Aurora.surfaceStrong,
  hairline: Aurora.hairline,
  text: Aurora.text,
  textDim: Aurora.textDim,
  textFaint: Aurora.textFaint,
  violet: Aurora.violet,
  indigo: Aurora.indigo,
  blue: Aurora.blue,
  pink: Aurora.pink,
  cyan: Aurora.cyan,
  gold: Aurora.gold,
  success: Aurora.success,
};

export const PALETTES: Record<ThemeName, Palette> = {
  aurora: { ...BASE, primary: "#A855F7", primaryGradient: ["#7C3AED", "#3B82F6", "#EC4899"], primarySoft: ["#8B5CF6", "#3B82F6"] },
  blue: { ...BASE, primary: "#3B82F6", primaryGradient: ["#60A5FA", "#3B82F6", "#1D4ED8"], primarySoft: ["#3B82F6", "#1D4ED8"] },
  pink: { ...BASE, primary: "#EC4899", primaryGradient: ["#F472B6", "#EC4899", "#A855F7"], primarySoft: ["#EC4899", "#A855F7"] },
  emerald: { ...BASE, primary: "#10B981", primaryGradient: ["#34D399", "#10B981", "#059669"], primarySoft: ["#34D399", "#059669"] },
  sunset: { ...BASE, primary: "#FB7185", primaryGradient: ["#FBBF24", "#FB7185", "#F43F5E"], primarySoft: ["#FB923C", "#F43F5E"] },
  gold: { ...BASE, primary: "#F5C24B", primaryGradient: ["#FDE68A", "#F5C24B", "#D97706"], primarySoft: ["#F5C24B", "#D97706"] },
  mono: { ...BASE, primary: "#A1A1AA", primaryGradient: ["#E4E4E7", "#A1A1AA", "#52525B"], primarySoft: ["#D4D4D8", "#71717A"] },
  ocean: { ...BASE, primary: "#06B6D4", primaryGradient: ["#22D3EE", "#06B6D4", "#0E7490"], primarySoft: ["#22D3EE", "#0891B2"] },
  plum: { ...BASE, primary: "#9333EA", primaryGradient: ["#C084FC", "#9333EA", "#6B21A8"], primarySoft: ["#A855F7", "#7E22CE"] },
  crimson: { ...BASE, primary: "#EF4444", primaryGradient: ["#FB7185", "#EF4444", "#B91C1C"], primarySoft: ["#F87171", "#DC2626"] },
};

export const THEME_NAMES: ThemeName[] = ["aurora", "blue", "pink", "emerald", "sunset", "gold", "mono", "ocean", "plum", "crimson"];

export function themeForGender(g: Gender): ThemeName {
  if (g === "male") return "blue";
  if (g === "female") return "pink";
  return "aurora";
}

interface ThemeState {
  t: Palette;
  name: ThemeName;
  gender: Gender;
  ready: boolean;
  setTheme: (n: ThemeName) => void;
  setGender: (g: Gender) => void;
}

const KEY_THEME = "meydanfest:theme";
const KEY_GENDER = "meydanfest:gender";

const ThemeCtx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>("aurora");
  const [gender, setGenderState] = useState<Gender>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedTheme, savedGender] = await Promise.all([
          AsyncStorage.getItem(KEY_THEME),
          AsyncStorage.getItem(KEY_GENDER),
        ]);
        const g = (savedGender as Gender) ?? null;
        setGenderState(g);
        if (savedTheme) setName(savedTheme as ThemeName);
        else if (g) setName(themeForGender(g)); // tema seçilmemişse cinsiyetten varsayılan
      } catch {
        /* yok say */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setTheme = useCallback((n: ThemeName) => {
    setName(n);
    AsyncStorage.setItem(KEY_THEME, n);
  }, []);

  const setGender = useCallback((g: Gender) => {
    setGenderState(g);
    if (g) AsyncStorage.setItem(KEY_GENDER, g);
    else AsyncStorage.removeItem(KEY_GENDER);
  }, []);

  return (
    <ThemeCtx.Provider value={{ t: PALETTES[name], name, gender, ready, setTheme, setGender }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
