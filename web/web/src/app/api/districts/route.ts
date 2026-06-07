import { NextResponse } from "next/server";
import { getDistrictsForCity } from "@/lib/districts";

export const dynamic = "force-dynamic";

/**
 * GET /api/districts?city=Adıyaman → { districts: ["Besni", "Çelikhan", ...] }
 *
 * Tamamen STATİK kaynaktan (turkiyeapi'den üretilmiş tam 81 il/973 ilçe listesi +
 * etkinlik snapshot ilçeleri). DB sorgusu YOK: Neon cold-start'ta /api/districts'in
 * timeout'a düşüp boş dönmesi (dropdown'un "sadece Tüm X ilçeleri" göstermesi)
 * sorununu kökten çözer. Anında + şaşmaz.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city");
  if (!city) {
    return NextResponse.json({ districts: [] });
  }
  return NextResponse.json({ districts: getDistrictsForCity(city) });
}
