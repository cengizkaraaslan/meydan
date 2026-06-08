export interface Country {
  /** ISO 3166-1 alpha-2 kodu */
  code: string;
  /** Türkçe ad */
  tr: string;
  /** İngilizce ad — Ticketmaster vb. ile uyumlu */
  name: string;
  /** Bayrak emojisi */
  flag: string;
}

/**
 * Kapsamlı ülke listesi. `name` alanı İngilizce ve Ticketmaster ülke adlarıyla
 * uyumludur ("Turkey", "United States", "United Kingdom", "United Arab Emirates"…).
 * Türkiye listenin başında.
 */
export const COUNTRIES: Country[] = [
  { code: "TR", tr: "Türkiye", name: "Turkey", flag: "🇹🇷" },
  { code: "US", tr: "Amerika Birleşik Devletleri", name: "United States", flag: "🇺🇸" },
  { code: "GB", tr: "Birleşik Krallık", name: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", tr: "Almanya", name: "Germany", flag: "🇩🇪" },
  { code: "FR", tr: "Fransa", name: "France", flag: "🇫🇷" },
  { code: "NL", tr: "Hollanda", name: "Netherlands", flag: "🇳🇱" },
  { code: "ES", tr: "İspanya", name: "Spain", flag: "🇪🇸" },
  { code: "IT", tr: "İtalya", name: "Italy", flag: "🇮🇹" },
  { code: "AE", tr: "Birleşik Arap Emirlikleri", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "AT", tr: "Avusturya", name: "Austria", flag: "🇦🇹" },
  { code: "BE", tr: "Belçika", name: "Belgium", flag: "🇧🇪" },
  { code: "CH", tr: "İsviçre", name: "Switzerland", flag: "🇨🇭" },
  { code: "SE", tr: "İsveç", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", tr: "Norveç", name: "Norway", flag: "🇳🇴" },
  { code: "DK", tr: "Danimarka", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", tr: "Finlandiya", name: "Finland", flag: "🇫🇮" },
  { code: "IE", tr: "İrlanda", name: "Ireland", flag: "🇮🇪" },
  { code: "PT", tr: "Portekiz", name: "Portugal", flag: "🇵🇹" },
  { code: "GR", tr: "Yunanistan", name: "Greece", flag: "🇬🇷" },
  { code: "PL", tr: "Polonya", name: "Poland", flag: "🇵🇱" },
  { code: "CZ", tr: "Çekya", name: "Czech Republic", flag: "🇨🇿" },
  { code: "SK", tr: "Slovakya", name: "Slovakia", flag: "🇸🇰" },
  { code: "HU", tr: "Macaristan", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", tr: "Romanya", name: "Romania", flag: "🇷🇴" },
  { code: "BG", tr: "Bulgaristan", name: "Bulgaria", flag: "🇧🇬" },
  { code: "HR", tr: "Hırvatistan", name: "Croatia", flag: "🇭🇷" },
  { code: "RS", tr: "Sırbistan", name: "Serbia", flag: "🇷🇸" },
  { code: "SI", tr: "Slovenya", name: "Slovenia", flag: "🇸🇮" },
  { code: "BA", tr: "Bosna-Hersek", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { code: "AL", tr: "Arnavutluk", name: "Albania", flag: "🇦🇱" },
  { code: "MK", tr: "Kuzey Makedonya", name: "North Macedonia", flag: "🇲🇰" },
  { code: "ME", tr: "Karadağ", name: "Montenegro", flag: "🇲🇪" },
  { code: "XK", tr: "Kosova", name: "Kosovo", flag: "🇽🇰" },
  { code: "UA", tr: "Ukrayna", name: "Ukraine", flag: "🇺🇦" },
  { code: "RU", tr: "Rusya", name: "Russia", flag: "🇷🇺" },
  { code: "BY", tr: "Belarus", name: "Belarus", flag: "🇧🇾" },
  { code: "LT", tr: "Litvanya", name: "Lithuania", flag: "🇱🇹" },
  { code: "LV", tr: "Letonya", name: "Latvia", flag: "🇱🇻" },
  { code: "EE", tr: "Estonya", name: "Estonia", flag: "🇪🇪" },
  { code: "IS", tr: "İzlanda", name: "Iceland", flag: "🇮🇸" },
  { code: "LU", tr: "Lüksemburg", name: "Luxembourg", flag: "🇱🇺" },
  { code: "CY", tr: "Kıbrıs", name: "Cyprus", flag: "🇨🇾" },
  { code: "MT", tr: "Malta", name: "Malta", flag: "🇲🇹" },
  { code: "AZ", tr: "Azerbaycan", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "GE", tr: "Gürcistan", name: "Georgia", flag: "🇬🇪" },
  { code: "AM", tr: "Ermenistan", name: "Armenia", flag: "🇦🇲" },
  { code: "KZ", tr: "Kazakistan", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "UZ", tr: "Özbekistan", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "TM", tr: "Türkmenistan", name: "Turkmenistan", flag: "🇹🇲" },
  { code: "KG", tr: "Kırgızistan", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "TJ", tr: "Tacikistan", name: "Tajikistan", flag: "🇹🇯" },
  { code: "SA", tr: "Suudi Arabistan", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "QA", tr: "Katar", name: "Qatar", flag: "🇶🇦" },
  { code: "KW", tr: "Kuveyt", name: "Kuwait", flag: "🇰🇼" },
  { code: "BH", tr: "Bahreyn", name: "Bahrain", flag: "🇧🇭" },
  { code: "OM", tr: "Umman", name: "Oman", flag: "🇴🇲" },
  { code: "JO", tr: "Ürdün", name: "Jordan", flag: "🇯🇴" },
  { code: "LB", tr: "Lübnan", name: "Lebanon", flag: "🇱🇧" },
  { code: "IL", tr: "İsrail", name: "Israel", flag: "🇮🇱" },
  { code: "IQ", tr: "Irak", name: "Iraq", flag: "🇮🇶" },
  { code: "IR", tr: "İran", name: "Iran", flag: "🇮🇷" },
  { code: "EG", tr: "Mısır", name: "Egypt", flag: "🇪🇬" },
  { code: "MA", tr: "Fas", name: "Morocco", flag: "🇲🇦" },
  { code: "DZ", tr: "Cezayir", name: "Algeria", flag: "🇩🇿" },
  { code: "TN", tr: "Tunus", name: "Tunisia", flag: "🇹🇳" },
  { code: "LY", tr: "Libya", name: "Libya", flag: "🇱🇾" },
  { code: "ZA", tr: "Güney Afrika", name: "South Africa", flag: "🇿🇦" },
  { code: "NG", tr: "Nijerya", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", tr: "Kenya", name: "Kenya", flag: "🇰🇪" },
  { code: "ET", tr: "Etiyopya", name: "Ethiopia", flag: "🇪🇹" },
  { code: "GH", tr: "Gana", name: "Ghana", flag: "🇬🇭" },
  { code: "CA", tr: "Kanada", name: "Canada", flag: "🇨🇦" },
  { code: "MX", tr: "Meksika", name: "Mexico", flag: "🇲🇽" },
  { code: "BR", tr: "Brezilya", name: "Brazil", flag: "🇧🇷" },
  { code: "AR", tr: "Arjantin", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", tr: "Şili", name: "Chile", flag: "🇨🇱" },
  { code: "CO", tr: "Kolombiya", name: "Colombia", flag: "🇨🇴" },
  { code: "PE", tr: "Peru", name: "Peru", flag: "🇵🇪" },
  { code: "UY", tr: "Uruguay", name: "Uruguay", flag: "🇺🇾" },
  { code: "VE", tr: "Venezuela", name: "Venezuela", flag: "🇻🇪" },
  { code: "CN", tr: "Çin", name: "China", flag: "🇨🇳" },
  { code: "JP", tr: "Japonya", name: "Japan", flag: "🇯🇵" },
  { code: "KR", tr: "Güney Kore", name: "South Korea", flag: "🇰🇷" },
  { code: "IN", tr: "Hindistan", name: "India", flag: "🇮🇳" },
  { code: "PK", tr: "Pakistan", name: "Pakistan", flag: "🇵🇰" },
  { code: "BD", tr: "Bangladeş", name: "Bangladesh", flag: "🇧🇩" },
  { code: "ID", tr: "Endonezya", name: "Indonesia", flag: "🇮🇩" },
  { code: "MY", tr: "Malezya", name: "Malaysia", flag: "🇲🇾" },
  { code: "SG", tr: "Singapur", name: "Singapore", flag: "🇸🇬" },
  { code: "TH", tr: "Tayland", name: "Thailand", flag: "🇹🇭" },
  { code: "VN", tr: "Vietnam", name: "Vietnam", flag: "🇻🇳" },
  { code: "PH", tr: "Filipinler", name: "Philippines", flag: "🇵🇭" },
  { code: "HK", tr: "Hong Kong", name: "Hong Kong", flag: "🇭🇰" },
  { code: "TW", tr: "Tayvan", name: "Taiwan", flag: "🇹🇼" },
  { code: "AU", tr: "Avustralya", name: "Australia", flag: "🇦🇺" },
  { code: "NZ", tr: "Yeni Zelanda", name: "New Zealand", flag: "🇳🇿" },
];

/** ISO2 koduyla ülke bulur (büyük/küçük harf duyarsız) */
export function findCountryByCode(code: string): Country | undefined {
  const c = code.trim().toUpperCase();
  return COUNTRIES.find((x) => x.code === c);
}
