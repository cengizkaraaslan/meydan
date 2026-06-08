/**
 * Admin API istemcisi — EtkinlikScout yönetim uçları (/api/v1/admin/*).
 * Yetki backend'de admin e-postası (query/body) ile doğrulanır; 403 → yetkisiz.
 */
import { API_BASE } from "./api";

// ───────────────────────────────────────────────────────────────────────────
// Tipler
// ───────────────────────────────────────────────────────────────────────────

/** Google ile giriş yapmış gerçek kullanıcı. */
export interface RealUser {
  type: "real";
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Anonim cihaz profili. */
export interface DeviceUser {
  type: "device";
  id: string;
  deviceId: string;
  city: string | null;
  district: string | null;
  gender: string | null;
  avatar: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  favorites: number;
  likes: number;
  attendances: number;
}

export type AdminUser = RealUser | DeviceUser;

export interface AdminUsersResp {
  ok: boolean;
  realCount: number;
  deviceCount: number;
  users: AdminUser[];
}

/** Bir bot/scraper'ın son çalışma kaydı. */
export interface ScraperRun {
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  success: boolean;
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  errorMessage: string | null;
}

export interface ScraperItem {
  source: string;
  label: string;
  lastRun: ScraperRun | null;
}

export interface ScrapersResp {
  ok: boolean;
  count: number;
  scrapers: ScraperItem[];
}

/** Tek bir botun tetikleme sonucu. */
export interface TriggerResult {
  source: string;
  success: boolean;
  itemsFound: number;
  durationMs: number;
  error: string | null;
}

export interface TriggerResp {
  ok: boolean;
  ranAt: string;
  scraperCount: number;
  successCount: number;
  totalWritten: number;
  results: TriggerResult[];
}

// ───────────────────────────────────────────────────────────────────────────
// İstemci
// ───────────────────────────────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

/** Yönetim ekranlarındaki hatalar için anlamlı mesaj. */
export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

function errorFor(status: number): AdminApiError {
  if (status === 403) return new AdminApiError(403, "Yetkiniz yok.");
  return new AdminApiError(status, `Sunucu hatası (${status}).`);
}

/** Gerçek + cihaz kullanıcılarını getirir. Hatada throw eder (ekran gösterir). */
export async function fetchAdminUsers(email: string): Promise<AdminUsersResp> {
  const url = `${API_BASE}/api/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw errorFor(res.status);
  const data = (await res.json()) as Partial<AdminUsersResp>;
  return {
    ok: data.ok ?? true,
    realCount: data.realCount ?? 0,
    deviceCount: data.deviceCount ?? 0,
    users: Array.isArray(data.users) ? data.users : [],
  };
}

/** Bot/scraper listesini + son çalışmalarını getirir. Hatada throw eder. */
export async function fetchScrapers(email: string): Promise<ScraperItem[]> {
  const url = `${API_BASE}/api/v1/admin/scrapers?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw errorFor(res.status);
  const data = (await res.json()) as Partial<ScrapersResp>;
  return Array.isArray(data.scrapers) ? data.scrapers : [];
}

/**
 * Botları çalıştırır. source verilirse o botu, verilmezse HEPSİNİ (uzun sürer).
 * Hatada throw eder.
 */
export async function triggerScraper(email: string, source?: string): Promise<TriggerResp> {
  const body: { email: string; source?: string } = { email };
  if (source) body.source = source;
  const res = await fetch(`${API_BASE}/api/v1/admin/scrapers`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw errorFor(res.status);
  const data = (await res.json()) as Partial<TriggerResp>;
  return {
    ok: data.ok ?? false,
    ranAt: data.ranAt ?? new Date().toISOString(),
    scraperCount: data.scraperCount ?? 0,
    successCount: data.successCount ?? 0,
    totalWritten: data.totalWritten ?? 0,
    results: Array.isArray(data.results) ? data.results : [],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Tarih biçimleme yardımcıları (runtime)
// ───────────────────────────────────────────────────────────────────────────

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** ISO tarihi → "12 Haz 2026" gibi okunaklı kısa biçim. */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO tarihi → "3 gün önce" / "az önce" gibi göreli biçim. */
export function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "az önce";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} saat önce`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} gün önce`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} ay önce`;
  const year = Math.floor(month / 12);
  return `${year} yıl önce`;
}

/** Süreyi (ms) → "1.2 sn" / "3 dk 5 sn" gibi okunaklı biçim. */
export function formatDuration(ms?: number | null): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} sn`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m} dk ${s} sn`;
}
