import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

/**
 * Etkinlik detay fotoğrafları — deviceId bazlı, sunucu kaynaklı (tüm cihazlarda ortak).
 * EventPhotoMobile tablosunu kullanır; tablo yoksa/DB hatasında in-memory'e düşer.
 */

export interface EventPhotoView {
  id: string;
  deviceId: string;
  url: string;
  createdAt: string; // ISO
}

export type PhotoMutReason = "notfound" | "forbidden";

// ── In-memory fallback ──────────────────────────────────────────────────────
interface MemPhoto {
  id: string;
  eventSlug: string;
  deviceId: string;
  url: string;
  createdAt: number;
}
const g = globalThis as unknown as { __eventPhotos?: MemPhoto[] };
const mem: MemPhoto[] = (g.__eventPhotos ??= []);
let seq = 0;
function memId(): string {
  seq += 1;
  return `ep_${Date.now().toString(36)}_${seq}`;
}
function memToView(p: MemPhoto): EventPhotoView {
  return { id: p.id, deviceId: p.deviceId, url: p.url, createdAt: new Date(p.createdAt).toISOString() };
}

export async function listEventPhotos(eventSlug: string): Promise<EventPhotoView[]> {
  return withDb(
    async () => {
      const rows = await db.eventPhotoMobile.findMany({ where: { eventSlug }, orderBy: { createdAt: "asc" } });
      return rows.map((r) => ({ id: r.id, deviceId: r.deviceId, url: r.url, createdAt: r.createdAt.toISOString() }));
    },
    () => mem.filter((p) => p.eventSlug === eventSlug).sort((a, b) => a.createdAt - b.createdAt).map(memToView),
  );
}

export async function addEventPhoto(input: {
  eventSlug: string;
  deviceId: string;
  url: string;
}): Promise<EventPhotoView> {
  return withDb(
    async () => {
      const r = await db.eventPhotoMobile.create({
        data: { eventSlug: input.eventSlug, deviceId: input.deviceId, url: input.url },
      });
      return { id: r.id, deviceId: r.deviceId, url: r.url, createdAt: r.createdAt.toISOString() };
    },
    () => {
      const p: MemPhoto = {
        id: memId(),
        eventSlug: input.eventSlug,
        deviceId: input.deviceId,
        url: input.url,
        createdAt: Date.now(),
      };
      mem.push(p);
      return memToView(p);
    },
  );
}

export async function deleteEventPhoto(input: {
  id: string;
  deviceId: string;
  isAdmin?: boolean;
}): Promise<{ ok: boolean; reason?: PhotoMutReason }> {
  return withDb(
    async () => {
      const existing = await db.eventPhotoMobile.findUnique({ where: { id: input.id } });
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (!input.isAdmin && existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      await db.eventPhotoMobile.delete({ where: { id: input.id } });
      return { ok: true };
    },
    () => {
      const existing = mem.find((p) => p.id === input.id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (!input.isAdmin && existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      const idx = mem.indexOf(existing);
      if (idx >= 0) mem.splice(idx, 1);
      return { ok: true };
    },
  );
}
