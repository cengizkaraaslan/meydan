/**
 * Vizyondaki filmler — web API (/api/v1/cinema). Veri web'de cinema-data.ts'te;
 * API her seans için lat/lng ekler (kullanıcıya mesafe hesaplamak için).
 */
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string; apiKey?: string };
const API_BASE = extra.apiBase ?? "https://etkinlikscout.vercel.app";
const API_KEY = extra.apiKey ?? "meydanfest-app";

export interface Showtime {
  city: string;
  theater: string;
  times: string[];
  lat: number | null;
  lng: number | null;
}

export interface Movie {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  posterUrl: string;
  backdropUrl?: string;
  durationMin: number;
  genres: string[];
  rating: number;
  ageRating: string;
  director: string;
  cast: string[];
  releaseDate: string;
  synopsis: string;
  trailerUrl?: string;
  showtimes: Showtime[];
}

interface CinemaResponse {
  ok?: boolean;
  data?: Movie[];
}

/** Vizyondaki filmleri çeker. Opsiyonel şehir filtresi. Hata → []. */
export async function fetchMovies(city?: string): Promise<Movie[]> {
  try {
    const url = new URL(`${API_BASE}/api/v1/cinema`);
    if (city) url.searchParams.set("city", city);
    const res = await fetch(url.toString(), {
      headers: { "x-api-key": API_KEY, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as CinemaResponse;
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

/** İki koordinat arası mesafe (km) — Haversine. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371; // dünya yarıçapı (km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
