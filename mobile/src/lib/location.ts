import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "meydanfest:detectedCity";
const KEY_MANUAL = "meydanfest:city"; // kullanıcının profilden seçtiği şehir (override)

// Manuel şehir değişimini dinleyenler (profil → keşfet senkronu)
type CityListener = (c: string | null) => void;
const cityListeners = new Set<CityListener>();

export async function setManualCity(city: string | null): Promise<void> {
  if (city) await AsyncStorage.setItem(KEY_MANUAL, city);
  else await AsyncStorage.removeItem(KEY_MANUAL);
  cityListeners.forEach((l) => l(city));
}

export async function getManualCity(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_MANUAL);
}

// Türkiye'nin 81 ili — eşleştirme için kanonik liste.
const TR_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik",
  "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum",
  "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir",
  "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
  "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis",
  "Kırıkkale", "Kırklareli", "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa",
  "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize",
  "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Şanlıurfa", "Şırnak", "Tekirdağ",
  "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
];

/** Türkiye'nin 81 ili (alfabetik) — combobox/şehir seçimi için. */
export const ALL_CITIES = TR_CITIES;

/**
 * Büyük şehirlerin ilçeleri — `/api/districts` boş/erişilemez olduğunda
 * yerel yedek (kategori ekranındaki ilçe filtresi hep görünsün diye).
 */
export const DISTRICTS_BY_CITY: Record<string, string[]> = {
  "İstanbul": ["Kadıköy", "Beşiktaş", "Şişli", "Beyoğlu", "Üsküdar", "Bakırköy", "Fatih", "Maltepe", "Ataşehir", "Kartal", "Pendik", "Sarıyer", "Bahçelievler", "Esenyurt", "Ümraniye", "Beylikdüzü", "Zeytinburnu", "Eyüpsultan", "Kağıthane", "Avcılar"],
  "Ankara": ["Çankaya", "Keçiören", "Yenimahalle", "Mamak", "Etimesgut", "Sincan", "Altındağ", "Pursaklar", "Gölbaşı", "Polatlı"],
  "İzmir": ["Konak", "Karşıyaka", "Bornova", "Buca", "Bayraklı", "Çiğli", "Gaziemir", "Karabağlar", "Balçova", "Narlıdere", "Urla", "Çeşme"],
  "Bursa": ["Osmangazi", "Nilüfer", "Yıldırım", "Mudanya", "Gemlik", "İnegöl", "Gürsu"],
  "Antalya": ["Muratpaşa", "Kepez", "Konyaaltı", "Alanya", "Manavgat", "Serik", "Kemer"],
  "Adana": ["Seyhan", "Çukurova", "Yüreğir", "Sarıçam", "Ceyhan"],
  "Konya": ["Selçuklu", "Meram", "Karatay"],
  "Kayseri": ["Melikgazi", "Kocasinan", "Talas"],
  "Mersin": ["Yenişehir", "Mezitli", "Toroslar", "Akdeniz", "Tarsus", "Erdemli"],
  "Eskişehir": ["Tepebaşı", "Odunpazarı"],
  "Gaziantep": ["Şahinbey", "Şehitkamil", "Oğuzeli"],
  "Kocaeli": ["İzmit", "Gebze", "Darıca", "Körfez", "Gölcük"],
  "Samsun": ["İlkadım", "Atakum", "Canik", "Tekkeköy"],
  "Trabzon": ["Ortahisar", "Akçaabat", "Yomra"],
  "Diyarbakır": ["Bağlar", "Kayapınar", "Yenişehir", "Sur"],
};

/** Verilen şehrin (varsa) yerel ilçe listesini döner; yoksa boş dizi. */
export function districtsFor(city: string | null): string[] {
  if (!city) return [];
  return DISTRICTS_BY_CITY[city] ?? [];
}

/** Türkçe karakterleri sadeleştirip karşılaştırma anahtarı üretir. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/i̇/g, "i")
    .replace(/[ışğüöç]/g, (c) => ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" }[c] ?? c))
    .replace(/[^a-z]/g, "")
    .trim();
}

const LOOKUP = new Map(TR_CITIES.map((c) => [norm(c), c]));
// Yaygın İngilizce/ASCII varyantlar
LOOKUP.set("istanbul", "İstanbul");
LOOKUP.set("izmir", "İzmir");
LOOKUP.set("urfa", "Şanlıurfa");
LOOKUP.set("maras", "Kahramanmaraş");
LOOKUP.set("antep", "Gaziantep");

export function matchCity(raw?: string | null): string | null {
  if (!raw) return null;
  const key = norm(raw);
  if (LOOKUP.has(key)) return LOOKUP.get(key)!;
  // "X Province" / "X ili" gibi ekleri temizleyip tekrar dene
  const stripped = key.replace(/province|ili|il$/g, "");
  return LOOKUP.get(stripped) ?? null;
}

/** Konumdan şehri tespit eder (izin ister). Bulamazsa null. Cache'i sessizce günceller. */
export async function detectCity(): Promise<string | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    // Önce son bilinen konum (anında döner); yoksa taze konum al. Low accuracy bazı
    // cihazlarda ilk açılışta takılıp null dönüyordu → Balanced + lastKnown fallback.
    let pos = await Location.getLastKnownPositionAsync();
    if (!pos) {
      pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    }
    if (!pos) return null;
    const geo = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const g = geo[0];
    const city = matchCity(g?.region) ?? matchCity(g?.city) ?? matchCity(g?.subregion);
    if (city) await AsyncStorage.setItem(KEY, city);
    return city;
  } catch {
    return null;
  }
}

/**
 * Açılışta: cache'lenmiş şehir varsa onu ANINDA döner ve KİLİTLER — yeni tespit
 * farklı olsa bile state'i değiştirmez (yalnızca cache'i sessizce günceller).
 * Böylece refresh'te şehrin zıplaması (#17 Bursa↔Eskişehir) önlenir.
 * Cache yoksa ilk tespit edilen şehir state'e yazılır.
 */
export function useDetectedCity() {
  const [city, setCity] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "none">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await AsyncStorage.getItem(KEY);
      // Cache varsa: onu kullan ve bu oturumda sabitle. Yeni tespit gelince
      // state'i DEĞİŞTİRME — yalnızca detectCity() içinde cache güncellenir.
      if (cached) {
        if (alive) {
          setCity(cached);
          setStatus("ok");
        }
        // Cache'i tazelemek için arka planda tespiti yine de tetikle (state'e dokunmadan).
        detectCity().catch(() => undefined);
        return;
      }
      // Cache yok: ilk tespit edilen şehir uygulanır.
      const detected = await detectCity();
      if (!alive) return;
      if (detected) {
        setCity(detected);
        setStatus("ok");
      } else {
        setStatus("denied");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { city, status };
}

/**
 * Aktif şehir = manuel seçim (profil) > konumdan tespit. Profilde değişince
 * (setManualCity) anında güncellenir.
 */
export function useActiveCity() {
  const { city: detected, status } = useDetectedCity();
  const [manual, setManual] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getManualCity().then((c) => alive && setManual(c));
    const l: CityListener = (c) => setManual(c);
    cityListeners.add(l);
    return () => {
      alive = false;
      cityListeners.delete(l);
    };
  }, []);

  const setCity = useCallback((c: string | null) => setManualCity(c), []);
  return { city: manual ?? detected, manual, detected, status, setCity };
}
