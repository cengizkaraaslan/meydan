import { NextResponse, type NextRequest } from "next/server";
import { CINEMA_MOVIES } from "@/lib/cinema-data";

export const dynamic = "force-dynamic";

/**
 * Sinema/AVM koordinat haritası — cinema-data.ts'teki tüm theater adları için
 * gerçekçi enlem/boylam (AVM/sinema konumlarına yakın; bilinmeyenler için makul
 * şehir-merkezi değerleri). Mobil tarafta kullanıcıya mesafe (km) hesaplamak için.
 */
const THEATER_COORDS: Record<string, { lat: number; lng: number }> = {
  // — İstanbul —
  "Cinemaximum Kanyon": { lat: 41.0782, lng: 29.0094 },
  "Cinemaximum Akasya": { lat: 41.0006, lng: 29.0633 },
  "Cinemaximum Zorlu Center": { lat: 41.0671, lng: 29.0152 },
  "Cinemaximum Watergarden": { lat: 40.9889, lng: 29.1206 },
  "Cinemaximum İstinye Park": { lat: 41.1106, lng: 29.0331 },
  "Cinemaximum Marmara Forum": { lat: 40.9904, lng: 28.8736 },
  "Cinemaximum Forum İstanbul": { lat: 41.0461, lng: 28.8978 },
  "Atlas 1948 Sineması": { lat: 41.0345, lng: 28.9799 },
  "Beyoğlu Sineması": { lat: 41.0331, lng: 28.9789 },
  // — Ankara —
  "Cinemaximum Next Level": { lat: 39.9046, lng: 32.8086 },
  "Cinemaximum Cepa": { lat: 39.9136, lng: 32.7889 },
  "Cinemaximum Panora": { lat: 39.8854, lng: 32.8389 },
  "Cinemaximum Armada": { lat: 39.9197, lng: 32.8094 },
  "Cinemaximum Kentpark": { lat: 39.9189, lng: 32.8073 },
  "Büyülü Fener Kızılay": { lat: 39.9189, lng: 32.8543 },
  // — İzmir —
  "Cinemaximum Mavibahçe": { lat: 38.4736, lng: 27.0639 },
  "Cinemaximum Optimum": { lat: 38.3911, lng: 27.0639 },
  "Cinemaximum Forum Bornova": { lat: 38.4631, lng: 27.2189 },
  "Cinemaximum Park Bornova": { lat: 38.4694, lng: 27.2106 },
  "Cinemaximum Hilltown": { lat: 38.4561, lng: 27.0822 },
  "Konak Pier Cinemarine": { lat: 38.4256, lng: 27.1339 },
  "Karaca Sineması": { lat: 38.4189, lng: 27.1289 },
  // — Bursa —
  "Cinemaximum Korupark": { lat: 40.2167, lng: 28.9756 },
  "Cinemaximum Podyum Park": { lat: 40.2347, lng: 28.9839 },
  "Cinemaximum Carrefour": { lat: 40.2231, lng: 28.9472 },
  "Cinemaximum Anatolium": { lat: 40.2256, lng: 29.0681 },
  // — Antalya —
  "Cinemaximum MarkAntalya": { lat: 36.8889, lng: 30.7028 },
  "Cinemaximum TerraCity": { lat: 36.8836, lng: 30.7331 },
  "Cinemaximum Agora": { lat: 36.9006, lng: 30.6889 },
  "Cinemaximum 5M Migros": { lat: 36.9097, lng: 30.6481 },
  "Özdilek Antalya": { lat: 36.8978, lng: 30.6789 },
};

/** Şehir merkezleri — theater haritasında yoksa fallback. cinema-data'da geçen iller. */
const CITY_CENTER: Record<string, { lat: number; lng: number }> = {
  "İstanbul": { lat: 41.0082, lng: 28.9784 },
  "Ankara": { lat: 39.9334, lng: 32.8597 },
  "İzmir": { lat: 38.4237, lng: 27.1428 },
  "Bursa": { lat: 40.1885, lng: 29.061 },
  "Antalya": { lat: 36.8969, lng: 30.7133 },
};

// Sinema verisi olan şehirler (şimdilik 5 büyük şehir).
const COVERED_CITIES = Object.keys(CITY_CENTER);

// Seçili şehir kapsanmıyorsa en yakını bulmak için geniş TR il-merkez koordinatları.
const TR_CITY_CENTER: Record<string, { lat: number; lng: number }> = {
  ...CITY_CENTER,
  "Adana": { lat: 37.0, lng: 35.3213 }, "Adıyaman": { lat: 37.7648, lng: 38.2786 },
  "Afyonkarahisar": { lat: 38.7507, lng: 30.5567 }, "Aydın": { lat: 37.848, lng: 27.8456 },
  "Balıkesir": { lat: 39.6484, lng: 27.8826 }, "Çanakkale": { lat: 40.1553, lng: 26.4142 },
  "Denizli": { lat: 37.7765, lng: 29.0864 }, "Diyarbakır": { lat: 37.9144, lng: 40.2306 },
  "Edirne": { lat: 41.6818, lng: 26.5623 }, "Elazığ": { lat: 38.6748, lng: 39.2226 },
  "Erzurum": { lat: 39.9, lng: 41.27 }, "Eskişehir": { lat: 39.7767, lng: 30.5206 },
  "Gaziantep": { lat: 37.0662, lng: 37.3833 }, "Hatay": { lat: 36.4018, lng: 36.3498 },
  "Isparta": { lat: 37.7648, lng: 30.5566 }, "Kayseri": { lat: 38.7312, lng: 35.4787 },
  "Kocaeli": { lat: 40.8533, lng: 29.8815 }, "Konya": { lat: 37.8714, lng: 32.4847 },
  "Malatya": { lat: 38.3552, lng: 38.3095 }, "Manisa": { lat: 38.6191, lng: 27.4289 },
  "Mersin": { lat: 36.8121, lng: 34.6415 }, "Muğla": { lat: 37.2153, lng: 28.3636 },
  "Sakarya": { lat: 40.7569, lng: 30.3781 }, "Samsun": { lat: 41.2867, lng: 36.33 },
  "Şanlıurfa": { lat: 37.1591, lng: 38.7969 }, "Tekirdağ": { lat: 40.9833, lng: 27.5167 },
  "Trabzon": { lat: 41.0015, lng: 39.7178 }, "Van": { lat: 38.4891, lng: 43.4089 },
};

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestCovered(origin: { lat: number; lng: number }): string {
  let best = COVERED_CITIES[0];
  let bestD = Infinity;
  for (const c of COVERED_CITIES) {
    const d = distKm(origin, CITY_CENTER[c]);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const apiKey = request.headers.get("x-api-key") ?? sp.get("api_key");
  if (process.env.NODE_ENV === "production" && !apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Send 'X-Api-Key' header or 'api_key' query param." },
      { status: 401 },
    );
  }

  const requestedCity = sp.get("city")?.trim() || null;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  const hasGps = !isNaN(lat) && !isNaN(lng);

  const hasMovies = (city: string) =>
    CINEMA_MOVIES.some((m) =>
      m.showtimes.some((s) => s.city.toLocaleLowerCase("tr") === city.toLocaleLowerCase("tr")),
    );

  // Hangi şehrin verisi gösterilecek: seçili şehir kapsanıyorsa o; değilse en yakın kapsanan.
  let cityUsed: string | null = requestedCity;
  let fallback = false;
  if (requestedCity && !hasMovies(requestedCity)) {
    const origin = hasGps ? { lat, lng } : TR_CITY_CENTER[requestedCity] ?? null;
    cityUsed = origin ? nearestCovered(origin) : COVERED_CITIES[0];
    fallback = true;
  } else if (!requestedCity && hasGps) {
    // Şehir seçili değil ama konum var → en yakın kapsanan şehir.
    cityUsed = nearestCovered({ lat, lng });
  }

  let movies = CINEMA_MOVIES;
  if (cityUsed) {
    const cf = cityUsed.toLocaleLowerCase("tr");
    movies = movies.filter((m) => m.showtimes.some((s) => s.city.toLocaleLowerCase("tr") === cf));
  }

  const data = movies.map((m) => ({
    ...m,
    showtimes: m.showtimes.map((s) => {
      const coord = THEATER_COORDS[s.theater] ?? CITY_CENTER[s.city] ?? null;
      return { ...s, lat: coord?.lat ?? null, lng: coord?.lng ?? null };
    }),
  }));

  return NextResponse.json({ ok: true, data, cityUsed, requestedCity, fallback, coveredCities: COVERED_CITIES });
}
