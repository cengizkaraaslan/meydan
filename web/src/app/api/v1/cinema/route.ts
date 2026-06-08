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

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const apiKey = request.headers.get("x-api-key") ?? sp.get("api_key");
  if (process.env.NODE_ENV === "production" && !apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Send 'X-Api-Key' header or 'api_key' query param." },
      { status: 401 },
    );
  }

  const cityFilter = sp.get("city")?.toLocaleLowerCase("tr") ?? null;

  let movies = CINEMA_MOVIES;
  if (cityFilter) {
    movies = movies.filter((m) =>
      m.showtimes.some((s) => s.city.toLocaleLowerCase("tr") === cityFilter),
    );
  }

  const data = movies.map((m) => ({
    ...m,
    showtimes: m.showtimes.map((s) => {
      const coord = THEATER_COORDS[s.theater] ?? CITY_CENTER[s.city] ?? null;
      return {
        ...s,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
      };
    }),
  }));

  return NextResponse.json({ ok: true, data });
}
