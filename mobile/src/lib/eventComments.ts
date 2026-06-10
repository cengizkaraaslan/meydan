import { API_BASE } from "./api";
import { getDeviceId } from "./profileSync";

/**
 * Etkinlik detay yorumları — sunucu kaynaklı (tüm cihazlarda ortak), deviceId sahipliği.
 * Yorum metninde "@email" geçerse backend o kişiye bildirim atar (tıklayınca etkinliğe gelir).
 */
export interface EventComment {
  id: string;
  deviceId: string;
  authorName: string;
  avatar: string | null;
  text: string;
  editedAt: string | null; // ISO
  createdAt: string; // ISO
}

const JSON_HDR = { "Content-Type": "application/json", Accept: "application/json" };
const BASE = `${API_BASE}/api/v1/mobile/event-comments`;

export async function fetchEventComments(eventSlug: string): Promise<EventComment[]> {
  try {
    const res = await fetch(`${BASE}?eventSlug=${encodeURIComponent(eventSlug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: EventComment[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function postEventComment(input: {
  eventSlug: string;
  authorName: string;
  avatar?: string | null;
  text: string;
}): Promise<EventComment | null> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(BASE, {
      method: "POST",
      headers: JSON_HDR,
      body: JSON.stringify({ ...input, deviceId }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { comment?: EventComment };
    return json.comment ?? null;
  } catch {
    return null;
  }
}

export async function editEventComment(
  id: string,
  text: string,
): Promise<{ ok: boolean; reason?: string; comment?: EventComment }> {
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(BASE, {
      method: "PATCH",
      headers: JSON_HDR,
      body: JSON.stringify({ id, deviceId, text }),
    });
    const json = (await res.json().catch(() => ({}))) as { reason?: string; comment?: EventComment };
    if (!res.ok) return { ok: false, reason: json.reason };
    return { ok: true, comment: json.comment };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function deleteEventComment(
  id: string,
  isAdmin = false,
): Promise<{ ok: boolean; reason?: string }> {
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
