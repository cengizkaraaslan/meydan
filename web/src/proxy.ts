import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";

const ADMIN_PREFIX = "/admin";
const LOCATION_COOKIE = "meydanfest_city";

const GEO_LOCALE: Record<string, Locale> = {
  TR: "tr", CY: "tr",
  DE: "de", AT: "de", CH: "de",
  FR: "fr", BE: "fr",
  ES: "es",
  IT: "it",
  RU: "ru",
  CN: "zh", TW: "zh", HK: "zh",
  JP: "ja",
  PT: "pt", BR: "pt",
  IR: "fa",
  SA: "ar", AE: "ar", EG: "ar",
};

/**
 * Vercel x-vercel-ip-city header'ından gelen ASCII şehir adını
 * 81 il listesindeki Türkçe karakterli ada normalize eder.
 * Tanımadığı şehirler için undefined döner — varsayılan İstanbul'a düşer.
 */
const TR_CITY_MAP: Record<string, string> = {
  "istanbul": "İstanbul",
  "ankara": "Ankara",
  "izmir": "İzmir",
  "bursa": "Bursa",
  "antalya": "Antalya",
  "adana": "Adana",
  "gaziantep": "Gaziantep",
  "konya": "Konya",
  "mersin": "Mersin",
  "kayseri": "Kayseri",
  "eskisehir": "Eskişehir",
  "diyarbakir": "Diyarbakır",
  "samsun": "Samsun",
  "trabzon": "Trabzon",
  "sanliurfa": "Şanlıurfa",
  "urfa": "Şanlıurfa",
  "manisa": "Manisa",
  "balikesir": "Balıkesir",
  "kahramanmaras": "Kahramanmaraş",
  "kocaeli": "Kocaeli",
  "izmit": "Kocaeli",
  "sakarya": "Sakarya",
  "adapazari": "Sakarya",
  "tekirdag": "Tekirdağ",
  "aydin": "Aydın",
  "denizli": "Denizli",
  "mugla": "Muğla",
  "hatay": "Hatay",
  "malatya": "Malatya",
  "erzurum": "Erzurum",
  "van": "Van",
  "ordu": "Ordu",
  "afyonkarahisar": "Afyonkarahisar",
  "afyon": "Afyonkarahisar",
  "canakkale": "Çanakkale",
  "elazig": "Elazığ",
  "isparta": "Isparta",
  "tokat": "Tokat",
  "sivas": "Sivas",
  "rize": "Rize",
  "giresun": "Giresun",
  "edirne": "Edirne",
  "duzce": "Düzce",
  "corum": "Çorum",
  "amasya": "Amasya",
  "kutahya": "Kütahya",
  "agri": "Ağrı",
  "ardahan": "Ardahan",
  "artvin": "Artvin",
  "batman": "Batman",
  "bartin": "Bartın",
  "bilecik": "Bilecik",
  "bingol": "Bingöl",
  "bitlis": "Bitlis",
  "bolu": "Bolu",
  "burdur": "Burdur",
  "cankiri": "Çankırı",
  "erzincan": "Erzincan",
  "gumushane": "Gümüşhane",
  "hakkari": "Hakkari",
  "igdir": "Iğdır",
  "karaman": "Karaman",
  "karabuk": "Karabük",
  "kars": "Kars",
  "kastamonu": "Kastamonu",
  "kilis": "Kilis",
  "kirklareli": "Kırklareli",
  "kirsehir": "Kırşehir",
  "kirikkale": "Kırıkkale",
  "mardin": "Mardin",
  "mus": "Muş",
  "nevsehir": "Nevşehir",
  "nigde": "Niğde",
  "osmaniye": "Osmaniye",
  "siirt": "Siirt",
  "sinop": "Sinop",
  "sirnak": "Şırnak",
  "tunceli": "Tunceli",
  "usak": "Uşak",
  "yalova": "Yalova",
  "yozgat": "Yozgat",
  "zonguldak": "Zonguldak",
  "aksaray": "Aksaray",
  "bayburt": "Bayburt",
  "adiyaman": "Adıyaman",
};

function normalizeIpCity(raw: string): string | undefined {
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ışğüöç]/g, (c) => ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" }[c]!))
    .trim();
  return TR_CITY_MAP[key];
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const authConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  if (pathname.startsWith(ADMIN_PREFIX) && authConfigured) {
    const session = req.auth;
    if (!session?.user) {
      const url = new URL("/giris", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  const res = NextResponse.next();

  const existing = req.cookies.get(LOCALE_COOKIE)?.value;
  if (!isLocale(existing)) {
    const country = req.headers.get("x-vercel-ip-country")?.toUpperCase();
    const mapped = country ? GEO_LOCALE[country] : undefined;
    if (mapped) {
      res.cookies.set(LOCALE_COOKIE, mapped, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    // Country yoksa cookie SET ETME → request.ts Accept-Language'i okusun
  }

  // Anonim ziyaretçiye Vercel IP geolocation header'ından şehir tahmini —
  // konum izni vermese bile anasayfa o şehrin etkinliklerini gösterir.
  // Sadece daha önce şehir cookie'si yoksa set edilir; kullanıcı sonradan
  // manuel veya GPS ile değiştirirse buranın yazısı dokunulmaz.
  if (!req.cookies.get(LOCATION_COOKIE)?.value) {
    const rawCity =
      req.headers.get("x-vercel-ip-city") ??
      req.headers.get("x-vercel-ip-country-region");
    if (rawCity) {
      const decoded = decodeURIComponent(rawCity);
      const normalized = normalizeIpCity(decoded);
      if (normalized) {
        res.cookies.set(LOCATION_COOKIE, encodeURIComponent(normalized), {
          path: "/",
          maxAge: 60 * 60 * 24 * 30, // 30 gün - IP'den tahmin daha kısa ömürlü
          sameSite: "lax",
        });
      }
    }
  }

  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
