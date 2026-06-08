/**
 * Ülke listesi — anasayfa konum seçicisindeki ülke dropdown'ı için.
 * code = ISO 3166-1 alpha-2 (reverseGeocode isoCountryCode ile eşleşir).
 * name = İngilizce ad (Ticketmaster/EtkinlikScout `country` parametresi).
 * tr   = Türkçe ad (UI'da gösterilir). flag = emoji bayrak.
 * Türkiye ilk sıradadır (varsayılan).
 */
export interface Country {
  code: string;
  tr: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "TR", tr: "Türkiye", name: "Turkey", flag: "🇹🇷" },
  { code: "US", tr: "ABD", name: "United States", flag: "🇺🇸" },
  { code: "GB", tr: "İngiltere", name: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", tr: "Almanya", name: "Germany", flag: "🇩🇪" },
  { code: "FR", tr: "Fransa", name: "France", flag: "🇫🇷" },
  { code: "NL", tr: "Hollanda", name: "Netherlands", flag: "🇳🇱" },
  { code: "ES", tr: "İspanya", name: "Spain", flag: "🇪🇸" },
  { code: "IT", tr: "İtalya", name: "Italy", flag: "🇮🇹" },
  { code: "AE", tr: "Birleşik Arap Emirlikleri", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "CA", tr: "Kanada", name: "Canada", flag: "🇨🇦" },
  { code: "AU", tr: "Avustralya", name: "Australia", flag: "🇦🇺" },
  { code: "MX", tr: "Meksika", name: "Mexico", flag: "🇲🇽" },
  { code: "BE", tr: "Belçika", name: "Belgium", flag: "🇧🇪" },
  { code: "AT", tr: "Avusturya", name: "Austria", flag: "🇦🇹" },
  { code: "CH", tr: "İsviçre", name: "Switzerland", flag: "🇨🇭" },
  { code: "SE", tr: "İsveç", name: "Sweden", flag: "🇸🇪" },
  { code: "IE", tr: "İrlanda", name: "Ireland", flag: "🇮🇪" },
  { code: "PT", tr: "Portekiz", name: "Portugal", flag: "🇵🇹" },
  { code: "PL", tr: "Polonya", name: "Poland", flag: "🇵🇱" },
  { code: "GR", tr: "Yunanistan", name: "Greece", flag: "🇬🇷" },
  { code: "RU", tr: "Rusya", name: "Russia", flag: "🇷🇺" },
  { code: "JP", tr: "Japonya", name: "Japan", flag: "🇯🇵" },
  { code: "KR", tr: "Güney Kore", name: "South Korea", flag: "🇰🇷" },
  { code: "CN", tr: "Çin", name: "China", flag: "🇨🇳" },
  { code: "IN", tr: "Hindistan", name: "India", flag: "🇮🇳" },
  { code: "BR", tr: "Brezilya", name: "Brazil", flag: "🇧🇷" },
  { code: "AR", tr: "Arjantin", name: "Argentina", flag: "🇦🇷" },
  { code: "EG", tr: "Mısır", name: "Egypt", flag: "🇪🇬" },
  { code: "SA", tr: "Suudi Arabistan", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "QA", tr: "Katar", name: "Qatar", flag: "🇶🇦" },
  { code: "ZA", tr: "Güney Afrika", name: "South Africa", flag: "🇿🇦" },
  { code: "NO", tr: "Norveç", name: "Norway", flag: "🇳🇴" },
  { code: "DK", tr: "Danimarka", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", tr: "Finlandiya", name: "Finland", flag: "🇫🇮" },
  { code: "CZ", tr: "Çekya", name: "Czech Republic", flag: "🇨🇿" },
  { code: "HU", tr: "Macaristan", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", tr: "Romanya", name: "Romania", flag: "🇷🇴" },
  { code: "BG", tr: "Bulgaristan", name: "Bulgaria", flag: "🇧🇬" },
  { code: "HR", tr: "Hırvatistan", name: "Croatia", flag: "🇭🇷" },
  { code: "RS", tr: "Sırbistan", name: "Serbia", flag: "🇷🇸" },
  { code: "SK", tr: "Slovakya", name: "Slovakia", flag: "🇸🇰" },
  { code: "SI", tr: "Slovenya", name: "Slovenia", flag: "🇸🇮" },
  { code: "UA", tr: "Ukrayna", name: "Ukraine", flag: "🇺🇦" },
  { code: "LT", tr: "Litvanya", name: "Lithuania", flag: "🇱🇹" },
  { code: "LV", tr: "Letonya", name: "Latvia", flag: "🇱🇻" },
  { code: "EE", tr: "Estonya", name: "Estonia", flag: "🇪🇪" },
  { code: "LU", tr: "Lüksemburg", name: "Luxembourg", flag: "🇱🇺" },
  { code: "IS", tr: "İzlanda", name: "Iceland", flag: "🇮🇸" },
  { code: "CY", tr: "Kıbrıs", name: "Cyprus", flag: "🇨🇾" },
  { code: "MT", tr: "Malta", name: "Malta", flag: "🇲🇹" },
  { code: "AZ", tr: "Azerbaycan", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "GE", tr: "Gürcistan", name: "Georgia", flag: "🇬🇪" },
  { code: "KZ", tr: "Kazakistan", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "IL", tr: "İsrail", name: "Israel", flag: "🇮🇱" },
  { code: "JO", tr: "Ürdün", name: "Jordan", flag: "🇯🇴" },
  { code: "LB", tr: "Lübnan", name: "Lebanon", flag: "🇱🇧" },
  { code: "KW", tr: "Kuveyt", name: "Kuwait", flag: "🇰🇼" },
  { code: "BH", tr: "Bahreyn", name: "Bahrain", flag: "🇧🇭" },
  { code: "OM", tr: "Umman", name: "Oman", flag: "🇴🇲" },
  { code: "MA", tr: "Fas", name: "Morocco", flag: "🇲🇦" },
  { code: "TN", tr: "Tunus", name: "Tunisia", flag: "🇹🇳" },
  { code: "DZ", tr: "Cezayir", name: "Algeria", flag: "🇩🇿" },
  { code: "NG", tr: "Nijerya", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", tr: "Kenya", name: "Kenya", flag: "🇰🇪" },
  { code: "TH", tr: "Tayland", name: "Thailand", flag: "🇹🇭" },
  { code: "SG", tr: "Singapur", name: "Singapore", flag: "🇸🇬" },
  { code: "MY", tr: "Malezya", name: "Malaysia", flag: "🇲🇾" },
  { code: "ID", tr: "Endonezya", name: "Indonesia", flag: "🇮🇩" },
  { code: "PH", tr: "Filipinler", name: "Philippines", flag: "🇵🇭" },
  { code: "VN", tr: "Vietnam", name: "Vietnam", flag: "🇻🇳" },
  { code: "NZ", tr: "Yeni Zelanda", name: "New Zealand", flag: "🇳🇿" },
  { code: "CL", tr: "Şili", name: "Chile", flag: "🇨🇱" },
  { code: "CO", tr: "Kolombiya", name: "Colombia", flag: "🇨🇴" },
  { code: "PE", tr: "Peru", name: "Peru", flag: "🇵🇪" },
  { code: "HK", tr: "Hong Kong", name: "Hong Kong", flag: "🇭🇰" },
  { code: "TW", tr: "Tayvan", name: "Taiwan", flag: "🇹🇼" },
];

/** Verilen ISO2 koduna karşılık gelen ülkeyi döner (büyük/küçük harf duyarsız). */
export function countryByCode(code?: string): Country | undefined {
  if (!code) return undefined;
  const c = code.toUpperCase();
  return COUNTRIES.find((x) => x.code === c);
}

/** Varsayılan ülke = Türkiye. */
export const DEFAULT_COUNTRY = COUNTRIES[0];
