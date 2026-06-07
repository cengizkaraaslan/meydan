export const LOCALES = [
  "tr", "en", "ar", "de", "fr", "es", "ru", "it", "zh", "ja", "pt", "fa",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

export const RTL_LOCALES: Locale[] = ["ar", "fa"];

export const LOCALE_LABELS: Record<Locale, { native: string; flag: string }> = {
  tr: { native: "Türkçe", flag: "🇹🇷" },
  en: { native: "English", flag: "🇬🇧" },
  ar: { native: "العربية", flag: "🇸🇦" },
  de: { native: "Deutsch", flag: "🇩🇪" },
  fr: { native: "Français", flag: "🇫🇷" },
  es: { native: "Español", flag: "🇪🇸" },
  ru: { native: "Русский", flag: "🇷🇺" },
  it: { native: "Italiano", flag: "🇮🇹" },
  zh: { native: "中文", flag: "🇨🇳" },
  ja: { native: "日本語", flag: "🇯🇵" },
  pt: { native: "Português", flag: "🇵🇹" },
  fa: { native: "فارسی", flag: "🇮🇷" },
};

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
