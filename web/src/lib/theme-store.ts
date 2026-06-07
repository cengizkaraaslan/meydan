import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

export type ThemeMode = "light" | "dark" | "auto";

export interface ThemeConfig {
  /** Görünüm modu */
  mode: ThemeMode;
  /** Ana marka rengi (CTA, vurgular) */
  primary: string;
  /** İkincil vurgu rengi */
  accent: string;
  /** Arka plan — light mode */
  backgroundLight: string;
  /** Arka plan — dark mode */
  backgroundDark: string;
  /** Metin — light */
  foregroundLight: string;
  /** Metin — dark */
  foregroundDark: string;
  /** Border radius (px) — global yuvarlaklık */
  radius: number;
  /** Font ailesi (Inter, Geist, vb. — root layout'ta tanımlı olmalı) */
  fontFamily: "geist" | "inter" | "system";
  /** Son güncelleme */
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_THEME: ThemeConfig = {
  mode: "auto",
  primary: "#7c3aed",
  accent: "#f59e0b",
  backgroundLight: "#ffffff",
  backgroundDark: "#0a0a0f",
  foregroundLight: "#0a0a0a",
  foregroundDark: "#f5f5f7",
  radius: 14,
  fontFamily: "geist",
  updatedAt: new Date().toISOString(),
};

interface ThemeStore {
  config: ThemeConfig;
}

const g = globalThis as unknown as { __themeStore?: ThemeStore };
g.__themeStore ??= { config: { ...DEFAULT_THEME } };

// DB satırı (SiteTheme) ↔ ThemeConfig
interface ThemeRow {
  mode: string;
  primary: string;
  accent: string;
  backgroundLight: string;
  backgroundDark: string;
  foregroundLight: string;
  foregroundDark: string;
  radius: number;
  fontFamily: string;
  updatedAt: Date;
  updatedBy: string | null;
}

function rowToTheme(r: ThemeRow): ThemeConfig {
  return {
    mode: r.mode as ThemeMode,
    primary: r.primary,
    accent: r.accent,
    backgroundLight: r.backgroundLight,
    backgroundDark: r.backgroundDark,
    foregroundLight: r.foregroundLight,
    foregroundDark: r.foregroundDark,
    radius: r.radius,
    fontFamily: r.fontFamily as ThemeConfig["fontFamily"],
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: r.updatedBy ?? undefined,
  };
}

function themeToDbData(t: ThemeConfig) {
  return {
    mode: t.mode,
    primary: t.primary,
    accent: t.accent,
    backgroundLight: t.backgroundLight,
    backgroundDark: t.backgroundDark,
    foregroundLight: t.foregroundLight,
    foregroundDark: t.foregroundDark,
    radius: t.radius,
    fontFamily: t.fontFamily,
  };
}

export async function getTheme(): Promise<ThemeConfig> {
  return withDb(
    async () => {
      const row = await db.siteTheme.findUnique({ where: { id: "default" } });
      return row ? rowToTheme(row) : { ...DEFAULT_THEME };
    },
    () => g.__themeStore!.config,
  );
}

export async function setTheme(
  patch: Partial<ThemeConfig>,
  updatedBy?: string,
): Promise<ThemeConfig> {
  return withDb(
    async () => {
      const existing = await db.siteTheme.findUnique({ where: { id: "default" } });
      const base = existing ? rowToTheme(existing) : DEFAULT_THEME;
      const merged: ThemeConfig = { ...base, ...patch };
      const data = themeToDbData(merged);
      const row = await db.siteTheme.upsert({
        where: { id: "default" },
        create: { id: "default", ...data, updatedBy: updatedBy ?? null },
        update: { ...data, updatedBy: updatedBy ?? null },
      });
      return rowToTheme(row);
    },
    () => {
      const merged: ThemeConfig = {
        ...g.__themeStore!.config,
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };
      g.__themeStore!.config = merged;
      return merged;
    },
  );
}

export async function resetTheme(updatedBy?: string): Promise<ThemeConfig> {
  return withDb(
    async () => {
      const data = themeToDbData(DEFAULT_THEME);
      const row = await db.siteTheme.upsert({
        where: { id: "default" },
        create: { id: "default", ...data, updatedBy: updatedBy ?? null },
        update: { ...data, updatedBy: updatedBy ?? null },
      });
      return rowToTheme(row);
    },
    () => {
      g.__themeStore!.config = {
        ...DEFAULT_THEME,
        updatedAt: new Date().toISOString(),
        updatedBy,
      };
      return g.__themeStore!.config;
    },
  );
}

/** Hex rengi RGB'ye çevirir (color-mix için) */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f0-9]{6}|[a-f0-9]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Hex'i %lik karışım/açıklık ile döndürür (ör. primary-foreground hesabı) */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  // YIQ luminance
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 140;
}

/** Tema config'inden global :root CSS override'ı üretir */
export function buildThemeCss(theme: ThemeConfig): string {
  const primaryFg = isLightColor(theme.primary) ? "#000000" : "#ffffff";
  const accentFg = isLightColor(theme.accent) ? "#000000" : "#ffffff";

  const lightVars = `
    --background: ${theme.backgroundLight};
    --foreground: ${theme.foregroundLight};
    --primary: ${theme.primary};
    --primary-foreground: ${primaryFg};
    --accent: ${theme.accent};
    --accent-foreground: ${accentFg};
    --radius: ${theme.radius}px;
  `.trim();

  const darkVars = `
    --background: ${theme.backgroundDark};
    --foreground: ${theme.foregroundDark};
    --primary: ${theme.primary};
    --primary-foreground: ${primaryFg};
    --accent: ${theme.accent};
    --accent-foreground: ${accentFg};
    --radius: ${theme.radius}px;
  `.trim();

  // Mode kuralı: auto → prefers-color-scheme'i bırak,
  // light → :root sabit light, dark → :root sabit dark.
  if (theme.mode === "light") {
    return `:root { ${lightVars} } @media (prefers-color-scheme: dark) { :root { ${lightVars} } }`;
  }
  if (theme.mode === "dark") {
    return `:root { ${darkVars} } @media (prefers-color-scheme: dark) { :root { ${darkVars} } }`;
  }
  // auto
  return `:root { ${lightVars} } @media (prefers-color-scheme: dark) { :root { ${darkVars} } }`;
}

/** Önceden tanımlı tema preset'leri */
export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  config: Partial<ThemeConfig>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    label: "MeydanFest (varsayılan)",
    description: "Mor + turuncu gradient",
    config: { primary: "#7c3aed", accent: "#f59e0b", radius: 14 },
  },
  {
    id: "festival",
    label: "Festival Ateşi",
    description: "Sıcak kırmızı + altın",
    config: { primary: "#dc2626", accent: "#fbbf24", radius: 18 },
  },
  {
    id: "ocean",
    label: "Okyanus",
    description: "Mavi + turkuaz",
    config: { primary: "#0284c7", accent: "#06b6d4", radius: 12 },
  },
  {
    id: "forest",
    label: "Orman",
    description: "Yeşil + zeytin",
    config: { primary: "#15803d", accent: "#84cc16", radius: 10 },
  },
  {
    id: "neon",
    label: "Neon Gece",
    description: "Pembe + cyan",
    config: { primary: "#ec4899", accent: "#06b6d4", radius: 20, mode: "dark" },
  },
  {
    id: "monochrome",
    label: "Mono",
    description: "Siyah-beyaz minimal",
    config: { primary: "#0a0a0a", accent: "#525252", radius: 6 },
  },
];
