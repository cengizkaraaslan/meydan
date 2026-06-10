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
  country?: string;
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
  country?: string;
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
  if (q.country) sp.set("country", q.country);
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

/**
 * Tıklanan etkinliği bellekte tutar → detay ekranına ağır JSON parametresi geçmeden,
 * yalnız id/slug ile yönlendiririz. Android navigasyon parametre limiti (uzun açıklamalı
 * üniversite etkinlikleri) ve boş-id (yalnız slug'lı kaynaklar) sorunlarını birlikte çözer.
 */
const _eventCache = new Map<string, ApiEvent>();
export function cacheEvent(e: ApiEvent): string {
  const key = e.id || e.slug || "";
  if (key) _eventCache.set(key, e);
  return key;
}
export function getCachedEvent(key: string): ApiEvent | null {
  return _eventCache.get(key) ?? null;
}

export async function fetchEventById(id: string): Promise<ApiEvent | null> {
  // Listeden ara; bulunamazsa null. Parametre id VEYA slug olabilir — sistem/duyuru
  // gönderileri (akış) yalnızca slug taşıdığı için ikisini de eşleştiriyoruz.
  try {
    const res = await fetchEvents({ pageSize: 100 });
    return res.data.find((e) => e.id === id || e.slug === id) ?? null;
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

// ───────────────────────────────────────────────────────────────────────────
// Dating (eşleşme + sohbet) API'leri — base aynı, API key gerekmez, kimlik=deviceId
// ───────────────────────────────────────────────────────────────────────────

/** Backend mesajı (eski→yeni). */
export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  at: number; // epoch ms
}

/** Eşleşme özeti (sohbet listesi/balon bunu kullanır). */
export interface MatchSummary {
  matchKey: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  createdAt: string;
}

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Mock eşleşme konuşması oluşturur (idempotent). matchKey döner. */
export async function apiEnsureMatch(input: {
  deviceId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
}): Promise<string | null> {
  const data = await postJson<{ ok?: boolean; matchKey?: string }>("/api/v1/dating/matches", input);
  return data?.matchKey ?? null;
}

/** Cihazın eşleşme özetlerini çeker (yeni→eski). */
export async function apiFetchMatches(deviceId: string): Promise<MatchSummary[]> {
  try {
    const url = new URL(`${API_BASE}/api/v1/dating/matches`);
    url.searchParams.set("deviceId", deviceId);
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const list: MatchSummary[] = data.data ?? [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Bir konuşmanın mesajlarını çeker (eski→yeni). Karşıdakini okundu işaretler. */
export async function apiFetchMessages(matchKey: string, deviceId: string): Promise<ChatMessage[]> {
  try {
    const url = new URL(`${API_BASE}/api/v1/dating/messages`);
    url.searchParams.set("matchKey", matchKey);
    url.searchParams.set("deviceId", deviceId);
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const list: ChatMessage[] = data.data ?? [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Mesaj gönderir. sender=deviceId → fromMe:true; sender=bot_<id> → fromMe:false (bot cevabı). */
export async function apiSendMessage(input: {
  matchKey: string;
  senderDeviceId: string;
  text: string;
}): Promise<ChatMessage | null> {
  const data = await postJson<{ ok?: boolean; message?: ChatMessage }>("/api/v1/dating/messages", input);
  return data?.message ?? null;
}

/** Genel amaçlı JSON istek yardımcısı (PATCH/DELETE). ok + reason döndürür. */
async function sendJson(
  method: "PATCH" | "DELETE",
  path: string,
  body: unknown,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    if (res.status === 403) return { ok: false, reason: "not_owner" };
    if (res.status === 409) return { ok: false, reason: "expired" };
    if (res.status === 404) return { ok: false, reason: "not_found" };
    return { ok: false, reason: `http_${res.status}` };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Metin mesajını düzenler (10 dk kuralı backend'de de doğrulanır). 403 sahip değil / 409 süre doldu / 404 yok. */
export async function apiEditMessage(input: {
  id: string;
  senderDeviceId: string;
  text: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendJson("PATCH", "/api/v1/dating/messages", input);
}

/** Metin mesajını siler (10 dk kuralı backend'de de doğrulanır). 403 / 409 / 404. */
export async function apiDeleteMessage(input: {
  id: string;
  senderDeviceId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendJson("DELETE", "/api/v1/dating/messages", input);
}
