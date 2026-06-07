/**
 * Türkiye 81 il için yaklaşık coğrafi koordinatlar (lat/lng).
 *
 * - Büyük ~20 şehir için gerçek merkez koordinatları.
 * - Geri kalan iller için bölge ortalamasına yakın makul yaklaşımlar.
 *
 * Not: `turkey-coords.ts`'teki SVG koordinatları HARİTA ÇİZİMİ içindir; gerçek
 * dünya mesafesi için BU dosyadaki lat/lng değerlerini kullan.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Şehir adı (Türkçe) → yaklaşık {lat, lng}. */
export const CITY_COORDS_LATLNG: Record<string, LatLng> = {
  // === Büyük şehirler — gerçek koordinatlar ===
  "İstanbul": { lat: 41.01, lng: 28.97 },
  "Ankara": { lat: 39.93, lng: 32.86 },
  "İzmir": { lat: 38.42, lng: 27.14 },
  "Bursa": { lat: 40.18, lng: 29.07 },
  "Antalya": { lat: 36.89, lng: 30.71 },
  "Adana": { lat: 36.99, lng: 35.32 },
  "Gaziantep": { lat: 37.07, lng: 37.38 },
  "Konya": { lat: 37.87, lng: 32.49 },
  "Kayseri": { lat: 38.73, lng: 35.48 },
  "Eskişehir": { lat: 39.78, lng: 30.52 },
  "Trabzon": { lat: 41.00, lng: 39.72 },
  "Diyarbakır": { lat: 37.91, lng: 40.24 },
  "Mersin": { lat: 36.81, lng: 34.63 },
  "Denizli": { lat: 37.78, lng: 29.09 },
  "Samsun": { lat: 41.29, lng: 36.33 },
  "Malatya": { lat: 38.35, lng: 38.32 },
  "Sakarya": { lat: 40.78, lng: 30.41 },
  "Van": { lat: 38.50, lng: 43.38 },
  "Erzurum": { lat: 39.90, lng: 41.27 },
  "Nevşehir": { lat: 38.62, lng: 34.71 },

  // === Marmara ===
  "Kocaeli": { lat: 40.77, lng: 29.94 },
  "Tekirdağ": { lat: 40.98, lng: 27.51 },
  "Balıkesir": { lat: 39.65, lng: 27.88 },
  "Çanakkale": { lat: 40.15, lng: 26.41 },
  "Edirne": { lat: 41.67, lng: 26.56 },
  "Kırklareli": { lat: 41.73, lng: 27.22 },
  "Yalova": { lat: 40.66, lng: 29.27 },
  "Bilecik": { lat: 40.14, lng: 29.98 },

  // === Ege ===
  "Manisa": { lat: 38.62, lng: 27.43 },
  "Aydın": { lat: 37.84, lng: 27.85 },
  "Muğla": { lat: 37.21, lng: 28.36 },
  "Uşak": { lat: 38.67, lng: 29.41 },
  "Afyonkarahisar": { lat: 38.76, lng: 30.54 },
  "Kütahya": { lat: 39.42, lng: 29.98 },

  // === Akdeniz ===
  "Hatay": { lat: 36.40, lng: 36.34 },
  "Osmaniye": { lat: 37.07, lng: 36.25 },
  "Kahramanmaraş": { lat: 37.58, lng: 36.93 },
  "Isparta": { lat: 37.76, lng: 30.55 },
  "Burdur": { lat: 37.72, lng: 30.29 },

  // === İç Anadolu ===
  "Aksaray": { lat: 38.37, lng: 34.03 },
  "Niğde": { lat: 37.97, lng: 34.69 },
  "Karaman": { lat: 37.18, lng: 33.21 },
  "Kırıkkale": { lat: 39.85, lng: 33.51 },
  "Kırşehir": { lat: 39.15, lng: 34.16 },
  "Yozgat": { lat: 39.82, lng: 34.81 },
  "Çankırı": { lat: 40.60, lng: 33.62 },
  "Sivas": { lat: 39.75, lng: 37.02 },

  // === Karadeniz ===
  "Bolu": { lat: 40.74, lng: 31.61 },
  "Düzce": { lat: 40.84, lng: 31.16 },
  "Zonguldak": { lat: 41.45, lng: 31.79 },
  "Bartın": { lat: 41.64, lng: 32.34 },
  "Karabük": { lat: 41.20, lng: 32.62 },
  "Kastamonu": { lat: 41.39, lng: 33.78 },
  "Sinop": { lat: 42.03, lng: 35.15 },
  "Çorum": { lat: 40.55, lng: 34.96 },
  "Amasya": { lat: 40.65, lng: 35.83 },
  "Tokat": { lat: 40.31, lng: 36.55 },
  "Ordu": { lat: 40.98, lng: 37.88 },
  "Giresun": { lat: 40.91, lng: 38.39 },
  "Rize": { lat: 41.02, lng: 40.52 },
  "Artvin": { lat: 41.18, lng: 41.82 },
  "Gümüşhane": { lat: 40.46, lng: 39.48 },
  "Bayburt": { lat: 40.26, lng: 40.22 },

  // === Doğu Anadolu ===
  "Erzincan": { lat: 39.75, lng: 39.49 },
  "Tunceli": { lat: 39.11, lng: 39.55 },
  "Elazığ": { lat: 38.68, lng: 39.23 },
  "Bingöl": { lat: 38.88, lng: 40.50 },
  "Muş": { lat: 38.74, lng: 41.51 },
  "Bitlis": { lat: 38.40, lng: 42.11 },
  "Ağrı": { lat: 39.72, lng: 43.06 },
  "Kars": { lat: 40.61, lng: 43.10 },
  "Iğdır": { lat: 39.92, lng: 44.05 },
  "Ardahan": { lat: 41.11, lng: 42.70 },
  "Hakkari": { lat: 37.57, lng: 43.74 },

  // === Güneydoğu ===
  "Şanlıurfa": { lat: 37.17, lng: 38.79 },
  "Adıyaman": { lat: 37.76, lng: 38.28 },
  "Mardin": { lat: 37.31, lng: 40.74 },
  "Batman": { lat: 37.88, lng: 41.13 },
  "Siirt": { lat: 37.93, lng: 41.94 },
  "Şırnak": { lat: 37.52, lng: 42.46 },
  "Kilis": { lat: 36.72, lng: 37.12 },
};

/** İki nokta arası kuş uçumu mesafe (km) — Haversine formülü. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Bilinen koordinatı olan en yakın şehri bulur.
 * @returns `{city, distanceKm}` veya tabloda hiç şehir yoksa `null`.
 */
export function findClosestCity(
  lat: number,
  lng: number,
): { city: string; distanceKm: number } | null {
  const me: LatLng = { lat, lng };
  let best: { city: string; distanceKm: number } | null = null;
  for (const [city, coord] of Object.entries(CITY_COORDS_LATLNG)) {
    const d = haversineKm(me, coord);
    if (best === null || d < best.distanceKm) {
      best = { city, distanceKm: d };
    }
  }
  return best;
}

/** Şehir adından lat/lng çevirimi — case-insensitive (TR locale). */
export function getCityLatLng(cityName: string): LatLng | undefined {
  if (CITY_COORDS_LATLNG[cityName]) return CITY_COORDS_LATLNG[cityName];
  const target = cityName.toLocaleLowerCase("tr");
  for (const key of Object.keys(CITY_COORDS_LATLNG)) {
    if (key.toLocaleLowerCase("tr") === target) return CITY_COORDS_LATLNG[key];
  }
  return undefined;
}
