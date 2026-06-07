/**
 * Türkiye 81 il için yaklaşık SVG koordinatları.
 *
 * viewBox 1000×500 referansı:
 *   - x: 0 (batı/Trakya) → 1000 (doğu/Iğdır)
 *   - y: 0 (kuzey/Karadeniz kıyısı) → 500 (güney/Akdeniz kıyısı)
 *
 * Koordinatlar coğrafi olarak doğru olmasın diye birebir lokasyon değil;
 * harita üzerinde tanınır bir pin dağılımı vermeyi hedefler. ~30-40 büyük
 * il yeterli olur — kalan iller alfabetik olarak makul konumlara yerleşti.
 */
export interface CityCoord {
  /** Tam Türkçe il adı (ör. "İstanbul"). */
  name: string;
  /** SVG viewBox 0-1000 aralığında x. */
  x: number;
  /** SVG viewBox 0-500 aralığında y. */
  y: number;
}

/** Şehir adı → koordinat (Türkçe key normalize edilmiş halde aranır). */
export const TURKEY_CITY_COORDS: Record<string, CityCoord> = {
  // === Büyük şehirler — referans noktalar ===
  "İstanbul":       { name: "İstanbul",       x: 290, y: 90  },
  "Ankara":         { name: "Ankara",         x: 490, y: 210 },
  "İzmir":          { name: "İzmir",          x: 170, y: 290 },
  "Bursa":          { name: "Bursa",          x: 290, y: 160 },
  "Antalya":        { name: "Antalya",        x: 370, y: 380 },
  "Adana":          { name: "Adana",          x: 575, y: 360 },
  "Gaziantep":      { name: "Gaziantep",      x: 650, y: 360 },
  "Konya":          { name: "Konya",          x: 460, y: 320 },
  "Kayseri":        { name: "Kayseri",        x: 565, y: 270 },
  "Mersin":         { name: "Mersin",         x: 530, y: 380 },
  "Diyarbakır":     { name: "Diyarbakır",     x: 720, y: 320 },
  "Şanlıurfa":      { name: "Şanlıurfa",      x: 680, y: 360 },
  "Eskişehir":      { name: "Eskişehir",      x: 365, y: 200 },
  "Trabzon":        { name: "Trabzon",        x: 730, y: 130 },
  "Samsun":         { name: "Samsun",         x: 620, y: 130 },
  "Van":            { name: "Van",            x: 870, y: 290 },
  "Erzurum":        { name: "Erzurum",        x: 790, y: 200 },
  "Malatya":        { name: "Malatya",        x: 650, y: 290 },
  "Denizli":        { name: "Denizli",        x: 250, y: 340 },
  "Muğla":          { name: "Muğla",          x: 230, y: 390 },
  "Sakarya":        { name: "Sakarya",        x: 335, y: 145 },
  "Kocaeli":        { name: "Kocaeli",        x: 320, y: 130 },
  "Balıkesir":      { name: "Balıkesir",      x: 220, y: 220 },
  "Manisa":         { name: "Manisa",         x: 200, y: 280 },
  "Hatay":          { name: "Hatay",          x: 615, y: 400 },
  "Aydın":          { name: "Aydın",          x: 200, y: 360 },
  "Tekirdağ":       { name: "Tekirdağ",       x: 230, y: 110 },
  "Çanakkale":      { name: "Çanakkale",      x: 155, y: 175 },
  "Edirne":         { name: "Edirne",         x: 175, y: 75  },
  "Sivas":          { name: "Sivas",          x: 615, y: 230 },
  "Kahramanmaraş":  { name: "Kahramanmaraş",  x: 620, y: 320 },
  "Mardin":         { name: "Mardin",         x: 745, y: 365 },

  // === Karadeniz iç sırası ===
  "Zonguldak":      { name: "Zonguldak",      x: 405, y: 115 },
  "Kastamonu":      { name: "Kastamonu",      x: 500, y: 130 },
  "Sinop":          { name: "Sinop",          x: 555, y: 90  },
  "Çorum":          { name: "Çorum",          x: 555, y: 175 },
  "Tokat":          { name: "Tokat",          x: 615, y: 180 },
  "Amasya":         { name: "Amasya",         x: 590, y: 160 },
  "Ordu":           { name: "Ordu",           x: 670, y: 130 },
  "Giresun":        { name: "Giresun",        x: 700, y: 135 },
  "Rize":           { name: "Rize",           x: 765, y: 130 },
  "Artvin":         { name: "Artvin",         x: 800, y: 130 },
  "Bartın":         { name: "Bartın",         x: 430, y: 110 },
  "Karabük":        { name: "Karabük",        x: 450, y: 130 },
  "Bolu":           { name: "Bolu",           x: 395, y: 150 },
  "Düzce":          { name: "Düzce",          x: 375, y: 135 },

  // === İç Anadolu ===
  "Bilecik":        { name: "Bilecik",        x: 330, y: 175 },
  "Kütahya":        { name: "Kütahya",        x: 305, y: 220 },
  "Afyonkarahisar": { name: "Afyonkarahisar", x: 345, y: 260 },
  "Uşak":           { name: "Uşak",           x: 270, y: 290 },
  "Çankırı":        { name: "Çankırı",        x: 510, y: 175 },
  "Kırıkkale":      { name: "Kırıkkale",      x: 525, y: 215 },
  "Kırşehir":       { name: "Kırşehir",       x: 525, y: 245 },
  "Yozgat":         { name: "Yozgat",         x: 580, y: 215 },
  "Nevşehir":       { name: "Nevşehir",       x: 555, y: 270 },
  "Aksaray":        { name: "Aksaray",        x: 510, y: 285 },
  "Niğde":          { name: "Niğde",          x: 540, y: 305 },
  "Karaman":        { name: "Karaman",        x: 490, y: 345 },
  "Isparta":        { name: "Isparta",        x: 350, y: 330 },
  "Burdur":         { name: "Burdur",         x: 325, y: 350 },

  // === Doğu Anadolu ===
  "Erzincan":       { name: "Erzincan",       x: 720, y: 215 },
  "Bayburt":        { name: "Bayburt",        x: 760, y: 175 },
  "Gümüşhane":      { name: "Gümüşhane",      x: 730, y: 165 },
  "Tunceli":        { name: "Tunceli",        x: 695, y: 245 },
  "Elazığ":         { name: "Elazığ",         x: 685, y: 275 },
  "Bingöl":         { name: "Bingöl",         x: 745, y: 255 },
  "Muş":            { name: "Muş",            x: 800, y: 265 },
  "Bitlis":         { name: "Bitlis",         x: 830, y: 285 },
  "Ağrı":           { name: "Ağrı",           x: 855, y: 230 },
  "Kars":           { name: "Kars",           x: 855, y: 175 },
  "Iğdır":          { name: "Iğdır",          x: 900, y: 210 },
  "Ardahan":        { name: "Ardahan",        x: 835, y: 145 },
  "Hakkari":        { name: "Hakkari",        x: 875, y: 345 },
  "Şırnak":         { name: "Şırnak",         x: 815, y: 360 },
  "Siirt":          { name: "Siirt",          x: 785, y: 330 },
  "Batman":         { name: "Batman",         x: 760, y: 320 },

  // === Güneydoğu ===
  "Adıyaman":       { name: "Adıyaman",       x: 660, y: 330 },
  "Kilis":          { name: "Kilis",          x: 640, y: 395 },
  "Osmaniye":       { name: "Osmaniye",       x: 600, y: 365 },

  // === Trakya / Marmara ekstra ===
  "Kırklareli":     { name: "Kırklareli",     x: 215, y: 70  },
  "Yalova":         { name: "Yalova",         x: 285, y: 140 },
};

/**
 * Türkçe büyük/küçük harf farkı için case-insensitive lookup.
 * (ToLowerInvariant tuzağı yok — JS toLowerCase TR locale ile çağrılıyor.)
 */
export function getCityCoord(cityName: string): CityCoord | undefined {
  if (TURKEY_CITY_COORDS[cityName]) return TURKEY_CITY_COORDS[cityName];
  const target = cityName.toLocaleLowerCase("tr");
  for (const key of Object.keys(TURKEY_CITY_COORDS)) {
    if (key.toLocaleLowerCase("tr") === target) return TURKEY_CITY_COORDS[key];
  }
  return undefined;
}

/**
 * Türkiye sınırının basitleştirilmiş SVG path'i (viewBox 1000×500).
 * Tanınır olsun yeterli — tam coğrafi doğruluk hedeflenmedi.
 * Trakya sol üstte ayrı bir parça, Anadolu ana kütle ve doğu uzantı dahil.
 */
export const TURKEY_OUTLINE_PATH =
  // Trakya (kuzeybatı uçtan kuzey-Marmara kıyısına)
  "M 150 50 L 230 50 L 260 80 L 270 110 L 235 130 L 200 125 L 170 115 L 150 95 Z " +
  // Anadolu ana kütlesi: kuzeyde Karadeniz kıyısı, doğuda Iğdır, güneyde Akdeniz, batıda Ege
  "M 270 130 L 320 105 L 380 100 L 450 105 L 530 95 L 600 100 L 680 110 L 760 115 L 820 125 " +
  "L 870 145 L 900 175 L 920 215 L 915 245 L 890 270 L 870 305 L 855 345 L 820 380 " +
  "L 760 395 L 700 405 L 630 410 L 565 410 L 490 405 L 420 390 L 360 405 L 290 410 " +
  "L 230 400 L 180 380 L 145 350 L 130 310 L 130 270 L 145 235 L 160 200 L 200 175 L 240 160 Z";
