/**
 * MeydanFest API istemcisi — EtkinlikScout public API (/api/v1/events).
 * Canlı veri: ~2100+ etkinlik. Anahtar prod'da sadece "boş olmasın" diye isteniyor.
 */
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string; apiKey?: string };
export const API_BASE = extra.apiBase ?? "https://etkinlikscout.vercel.app";
const API_KEY = extra.apiKey ?? "meydanfest-app";

export interface ApiEvent {
  id: string;
  slug: string;
  source: string;
  title: string;
  description: string | null;
  category: string;
  venue: string;
  city: string;
  starts_at: string;
  ends_at: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  ticket_url: string | null;
  image_url: string | null;
  artist: string | null;
}

export interface EventsMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface EventsResponse {
  data: ApiEvent[];
  meta: EventsMeta;
}

export interface EventQuery {
  city?: string;
  category?: string;
  freeOnly?: boolean;
  search?: string;
  from?: string; // ISO
  to?: string; // ISO
  page?: number;
  pageSize?: number;
}

export async function fetchEvents(q: EventQuery = {}): Promise<EventsResponse> {
  const sp = new URLSearchParams();
  if (q.city) sp.set("city", q.city);
  if (q.category) sp.set("category", q.category);
  if (q.freeOnly) sp.set("free", "1");
  if (q.search) sp.set("q", q.search);
  if (q.from) sp.set("from", q.from);
  if (q.to) sp.set("to", q.to);
  sp.set("page", String(q.page ?? 1));
  sp.set("page_size", String(q.pageSize ?? 20));

  const res = await fetch(`${API_BASE}/api/v1/events?${sp.toString()}`, {
    headers: { "x-api-key": API_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as EventsResponse;
}

export async function fetchEventById(id: string): Promise<ApiEvent | null> {
  // v1 tekil endpoint slug bazlı; listeden id ile bulmak en güvenlisi (küçük sayfa).
  // Önce geniş bir sayfadan ara; bulunamazsa null.
  try {
    const res = await fetchEvents({ pageSize: 100 });
    return res.data.find((e) => e.id === id) ?? null;
  } catch {
    return null;
  }
}

/** Bilinen CDN url'lerinde çözünürlüğü artır (Unsplash: w=1600&q=85). Diğerlerinde aynen döner. */
export function hiRes(url: string): string {
  if (!/images\.unsplash\.com/.test(url)) return url;
  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("w", "1600");
  params.set("q", "85");
  if (!params.has("auto")) params.set("auto", "format");
  if (!params.has("fit")) params.set("fit", "crop");
  return `${base}?${params.toString()}`;
}

/** Gerçek görseli yüksek çözünürlüğe çek; yoksa kategoriye göre yüksek çözünürlüklü Unsplash fallback'i. */
export function imageFor(e: ApiEvent): string {
  if (e.image_url) return hiRes(e.image_url);
  const map: Record<string, string> = {
    KONSER: "1470225620780-dba8ba36b745",
    FESTIVAL: "1533174072545-7a4b6ad7a6c3",
    TIYATRO: "1503095396549-807759245b35",
    STANDUP: "1585699324551-f6c309eedeca",
    SPOR: "1461896836934-ffe607ba8211",
    SERGI: "1531058020387-3be344556be6",
    ATOLYE: "1556761175-5973dc0f32e7",
    COCUK: "1503454537195-1dcabb73ffb9",
    DIGER: "1492684223066-81342ee5ff30",
  };
  const code = map[e.category] ?? map.DIGER;
  return `https://images.unsplash.com/photo-${code}?auto=format&fit=crop&w=1600&q=85`;
}
