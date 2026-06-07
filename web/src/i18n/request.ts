import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, isLocale, type Locale } from "./config";

const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  TR: "tr",
  CY: "tr",
  DE: "de", AT: "de", CH: "de",
  FR: "fr", BE: "fr", CA: "fr",
  ES: "es", MX: "es", AR: "es", CL: "es", CO: "es",
  IT: "it",
  RU: "ru", BY: "ru", KZ: "ru",
  CN: "zh", TW: "zh", HK: "zh",
  JP: "ja",
  PT: "pt", BR: "pt",
  IR: "fa",
  SA: "ar", AE: "ar", EG: "ar", JO: "ar", LB: "ar", KW: "ar", QA: "ar",
};

async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headersList = await headers();
  const country = headersList.get("x-vercel-ip-country")?.toUpperCase();
  if (country && COUNTRY_TO_LOCALE[country]) {
    return COUNTRY_TO_LOCALE[country];
  }

  const acceptLang = headersList.get("accept-language") ?? "";
  for (const part of acceptLang.split(",")) {
    const code = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(code)) return code;
  }

  return country ? "en" : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  const safeLocale = (LOCALES as readonly string[]).includes(locale) ? locale : DEFAULT_LOCALE;
  const messages = (await import(`../../messages/${safeLocale}.json`)).default;
  return { locale: safeLocale, messages };
});
