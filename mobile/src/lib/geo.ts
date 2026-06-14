import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { fmtDistance } from "./format";
import type { ApiEvent } from "./api";

/**
 * Konum/mesafe altyapısı. Etkinliklerde gerçek lat/lng YOK — yalnız şehir/ülke metni.
 * Bu yüzden mesafe ŞEHİR-MERKEZİ koordinatına göre YAKLAŞIK hesaplanır ("~12 km").
 * Aynı şehir içindeki etkinlikler benzer mesafe verir; asıl değer şehirler arası
 * (en yakın etkinlikleri öne almak) ve "uzakta mı" sinyalindedir.
 */

export interface Coords {
  lat: number;
  lng: number;
}

const GPS_KEY = "meydanfest:gps"; // kullanıcının son bilinen GPS'i {lat,lng}

type CoordsListener = (c: Coords | null) => void;
const coordsListeners = new Set<CoordsListener>();
let coordsCache: Coords | null = null;
let coordsLoaded = false;

/** Kullanıcının GPS koordinatını sakla + dinleyenleri uyar (location.ts tespit edince çağırır). */
export async function setUserCoords(c: Coords | null): Promise<void> {
  coordsCache = c;
  coordsLoaded = true;
  try {
    if (c) await AsyncStorage.setItem(GPS_KEY, JSON.stringify(c));
    else await AsyncStorage.removeItem(GPS_KEY);
  } catch {
    // yerel kayıt başarısızsa sessizce yut
  }
  coordsListeners.forEach((l) => l(c));
}

/** Saklı GPS koordinatını oku (yoksa null). */
export async function getUserCoords(): Promise<Coords | null> {
  if (coordsLoaded) return coordsCache;
  try {
    const raw = await AsyncStorage.getItem(GPS_KEY);
    coordsCache = raw ? (JSON.parse(raw) as Coords) : null;
  } catch {
    coordsCache = null;
  }
  coordsLoaded = true;
  return coordsCache;
}

/** Reaktif kullanıcı koordinatı (badge/sıralama için). */
export function useUserCoords(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(coordsCache);
  useEffect(() => {
    let alive = true;
    getUserCoords().then((c) => alive && setCoords(c));
    const l: CoordsListener = (c) => setCoords(c);
    coordsListeners.add(l);
    return () => {
      alive = false;
      coordsListeners.delete(l);
    };
  }, []);
  return coords;
}

/** İki nokta arası büyük-çember mesafe (km). */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Türkçe karakterleri sadeleştirip anahtar üretir (location.ts ile aynı mantık). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/i̇/g, "i")
    .replace(/[ışğüöç]/g, (c) => ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" }[c] ?? c))
    .replace(/[^a-z]/g, "")
    .trim();
}

// Türkiye'nin 81 ili — il merkezi yaklaşık koordinatları.
const TR_CITY_COORDS: Record<string, Coords> = {
  Adana: { lat: 37.0, lng: 35.32 }, Adıyaman: { lat: 37.76, lng: 38.28 },
  Afyonkarahisar: { lat: 38.76, lng: 30.54 }, Ağrı: { lat: 39.72, lng: 43.05 },
  Aksaray: { lat: 38.37, lng: 34.03 }, Amasya: { lat: 40.65, lng: 35.83 },
  Ankara: { lat: 39.92, lng: 32.85 }, Antalya: { lat: 36.9, lng: 30.7 },
  Ardahan: { lat: 41.11, lng: 42.7 }, Artvin: { lat: 41.18, lng: 41.82 },
  Aydın: { lat: 37.85, lng: 27.84 }, Balıkesir: { lat: 39.65, lng: 27.88 },
  Bartın: { lat: 41.63, lng: 32.34 }, Batman: { lat: 37.88, lng: 41.13 },
  Bayburt: { lat: 40.26, lng: 40.22 }, Bilecik: { lat: 40.14, lng: 29.98 },
  Bingöl: { lat: 38.88, lng: 40.5 }, Bitlis: { lat: 38.4, lng: 42.11 },
  Bolu: { lat: 40.74, lng: 31.61 }, Burdur: { lat: 37.72, lng: 30.29 },
  Bursa: { lat: 40.18, lng: 29.07 }, Çanakkale: { lat: 40.15, lng: 26.41 },
  Çankırı: { lat: 40.6, lng: 33.62 }, Çorum: { lat: 40.55, lng: 34.95 },
  Denizli: { lat: 37.78, lng: 29.09 }, Diyarbakır: { lat: 37.91, lng: 40.24 },
  Düzce: { lat: 40.84, lng: 31.16 }, Edirne: { lat: 41.68, lng: 26.56 },
  Elazığ: { lat: 38.68, lng: 39.22 }, Erzincan: { lat: 39.75, lng: 39.49 },
  Erzurum: { lat: 39.9, lng: 41.27 }, Eskişehir: { lat: 39.78, lng: 30.52 },
  Gaziantep: { lat: 37.07, lng: 37.38 }, Giresun: { lat: 40.91, lng: 38.39 },
  Gümüşhane: { lat: 40.46, lng: 39.48 }, Hakkari: { lat: 37.57, lng: 43.74 },
  Hatay: { lat: 36.2, lng: 36.16 }, Iğdır: { lat: 39.92, lng: 44.04 },
  Isparta: { lat: 37.76, lng: 30.55 }, İstanbul: { lat: 41.01, lng: 28.98 },
  İzmir: { lat: 38.42, lng: 27.14 }, Kahramanmaraş: { lat: 37.58, lng: 36.93 },
  Karabük: { lat: 41.2, lng: 32.63 }, Karaman: { lat: 37.18, lng: 33.22 },
  Kars: { lat: 40.6, lng: 43.1 }, Kastamonu: { lat: 41.39, lng: 33.78 },
  Kayseri: { lat: 38.73, lng: 35.49 }, Kilis: { lat: 36.72, lng: 37.12 },
  Kırıkkale: { lat: 39.85, lng: 33.52 }, Kırklareli: { lat: 41.74, lng: 27.22 },
  Kırşehir: { lat: 39.15, lng: 34.16 }, Kocaeli: { lat: 40.77, lng: 29.92 },
  Konya: { lat: 37.87, lng: 32.49 }, Kütahya: { lat: 39.42, lng: 29.98 },
  Malatya: { lat: 38.36, lng: 38.31 }, Manisa: { lat: 38.61, lng: 27.43 },
  Mardin: { lat: 37.31, lng: 40.74 }, Mersin: { lat: 36.81, lng: 34.64 },
  Muğla: { lat: 37.22, lng: 28.36 }, Muş: { lat: 38.74, lng: 41.49 },
  Nevşehir: { lat: 38.62, lng: 34.71 }, Niğde: { lat: 37.97, lng: 34.68 },
  Ordu: { lat: 40.98, lng: 37.88 }, Osmaniye: { lat: 37.07, lng: 36.25 },
  Rize: { lat: 41.02, lng: 40.52 }, Sakarya: { lat: 40.78, lng: 30.4 },
  Samsun: { lat: 41.29, lng: 36.33 }, Siirt: { lat: 37.93, lng: 41.94 },
  Sinop: { lat: 42.03, lng: 35.15 }, Sivas: { lat: 39.75, lng: 37.02 },
  Şanlıurfa: { lat: 37.16, lng: 38.79 }, Şırnak: { lat: 37.52, lng: 42.46 },
  Tekirdağ: { lat: 40.98, lng: 27.51 }, Tokat: { lat: 40.31, lng: 36.55 },
  Trabzon: { lat: 41.0, lng: 39.72 }, Tunceli: { lat: 39.11, lng: 39.55 },
  Uşak: { lat: 38.68, lng: 29.41 }, Van: { lat: 38.49, lng: 43.41 },
  Yalova: { lat: 40.65, lng: 29.28 }, Yozgat: { lat: 39.82, lng: 34.81 },
  Zonguldak: { lat: 41.45, lng: 31.79 },
};

// Yurt dışı etkinlikler için ülke (İngilizce ad) merkez koordinatı — kaba uzaklık sinyali.
const COUNTRY_COORDS: Record<string, Coords> = {
  turkey: { lat: 39.0, lng: 35.0 },
  "united states": { lat: 39.83, lng: -98.58 },
  germany: { lat: 51.0, lng: 10.0 },
  france: { lat: 46.6, lng: 2.2 },
  netherlands: { lat: 52.1, lng: 5.3 },
  spain: { lat: 40.0, lng: -3.7 },
  italy: { lat: 41.9, lng: 12.5 },
  "united kingdom": { lat: 54.0, lng: -2.0 },
  "united arab emirates": { lat: 24.0, lng: 54.0 },
  canada: { lat: 56.0, lng: -106.0 },
  australia: { lat: -25.0, lng: 133.0 },
  mexico: { lat: 23.6, lng: -102.5 },
  belgium: { lat: 50.5, lng: 4.5 },
  austria: { lat: 47.5, lng: 14.5 },
  switzerland: { lat: 46.8, lng: 8.2 },
  sweden: { lat: 60.1, lng: 18.6 },
  ireland: { lat: 53.4, lng: -8.0 },
  portugal: { lat: 39.5, lng: -8.0 },
  poland: { lat: 52.0, lng: 19.0 },
};

const TR_LOOKUP = new Map(Object.entries(TR_CITY_COORDS).map(([k, v]) => [norm(k), v]));

/**
 * Verilen GPS koordinatına en yakın Türkiye il merkezini döner — `reverseGeocodeAsync`
 * Android'de boş dönerse/patlarsa (Play Services'siz cihaz, geocoder backend yok) konum
 * yine de şehre çevrilsin diye yedek. Türkiye dışındaysa (en yakın il bile >250 km) null
 * döner ki yanlış il atanmasın.
 */
export function nearestCity(coords: Coords): string | null {
  let best: string | null = null;
  let bestKm = Infinity;
  for (const [city, c] of Object.entries(TR_CITY_COORDS)) {
    const km = haversineKm(coords, c);
    if (km < bestKm) {
      bestKm = km;
      best = city;
    }
  }
  return bestKm <= 250 ? best : null;
}

/** Etkinliğin (yaklaşık) koordinatı: önce şehir merkezi, yoksa ülke merkezi, yoksa null. */
export function coordsForEvent(e: Pick<ApiEvent, "city" | "country">): Coords | null {
  if (e.city) {
    const byCity = TR_LOOKUP.get(norm(e.city));
    if (byCity) return byCity;
  }
  if (e.country) {
    const byCountry = COUNTRY_COORDS[e.country.trim().toLowerCase()];
    if (byCountry) return byCountry;
  }
  return null;
}

/** Kullanıcı→etkinlik yaklaşık mesafe (km). Koordinat bilinmezse null. */
export function eventDistanceKm(e: Pick<ApiEvent, "city" | "country">, user: Coords | null): number | null {
  if (!user) return null;
  const ec = coordsForEvent(e);
  if (!ec) return null;
  return haversineKm(user, ec);
}

/** Mesafe rozeti metni ("~" yaklaşık vurgusuyla). Bilinmezse null. */
export function approxDistanceLabel(e: Pick<ApiEvent, "city" | "country">, user: Coords | null): string | null {
  const km = eventDistanceKm(e, user);
  if (km == null) return null;
  // Aynı şehir merkezine çok yakınsa "yakınında" de (sahte hassasiyet verme).
  if (km < 1.5) return "yakınında";
  return `~${fmtDistance(km)}`;
}

/** Yer (müze) GERÇEK lat/lng taşır → kullanıcıya net km mesafe. Koordinat/konum yoksa null. */
export function placeDistanceKm(p: { lat?: number | null; lng?: number | null }, user: Coords | null): number | null {
  if (!user || p.lat == null || p.lng == null) return null;
  return haversineKm(user, { lat: p.lat, lng: p.lng });
}

/** Yer için mesafe etiketi ("450 m" / "12 km"). Bilinmezse null. */
export function placeDistanceLabel(p: { lat?: number | null; lng?: number | null }, user: Coords | null): string | null {
  const km = placeDistanceKm(p, user);
  return km == null ? null : fmtDistance(km);
}
