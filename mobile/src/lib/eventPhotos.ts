import { API_BASE } from "./api";
import { getDeviceId } from "./profileSync";

/**
 * Etkinlik detay fotoğrafları — sunucu kaynaklı (tüm cihazlarda ortak), deviceId sahipliği.
 * Görsel önce R2'ye yüklenir (uploadImage), sonra url'i buraya kaydedilir.
 */
export interface EventPhoto {
  id: string;
  deviceId: string;
  url: string;
  createdAt: string; // ISO
}

const JSON_HDR = { "Content-Type": "application/json", Accept: "application/json" };
const BASE = `${API_BASE}/api/v1/mobile/event-photos`;

export async function fetchEventPhotos(eventSlug: string): Promise<EventPhoto[]> {
  try {
    const res = await fetch(`${BASE}?eventSlug=${encodeURIComponent(eventSlug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: EventPhoto[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function postEventPhoto(eventSlug: string, url: string): Promise<EventPhoto | null> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(BASE, {
      method: "POST",
      headers: JSON_HDR,
      body: JSON.stringify({ eventSlug, deviceId, url }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { photo?: EventPhoto };
    return json.photo ?? null;
  } catch {
    return null;
  }
}

export async function deleteEventPhoto(id: string, isAdmin = false): Promise<{ ok: boolean; reason?: string }> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(BASE, {
      method: "DELETE",
      headers: JSON_HDR,
      body: JSON.stringify({ id, deviceId, isAdmin }),
    });
    const json = (await res.json().catch(() => ({}))) as { reason?: string };
    if (!res.ok) return { ok: false, reason: json.reason };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
