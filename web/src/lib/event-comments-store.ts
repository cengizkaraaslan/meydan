import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

/**
 * Etkinlik detay yorumları — deviceId bazlı, sunucu kaynaklı (tüm cihazlarda ortak).
 * EventCommentMobile tablosunu kullanır; tablo yoksa/DB hatasında in-memory'e düşer.
 */

/** Yorum düzenleme penceresi (gönderimden sonra 2 dk) — eski mobil davranışıyla aynı. */
export const EVENT_COMMENT_EDIT_WINDOW_MS = 2 * 60 * 1000;

export interface EventCommentView {
  id: string;
  deviceId: string;
  authorName: string;
  avatar: string | null;
  text: string;
  editedAt: string | null; // ISO
  createdAt: string; // ISO
}

export type CommentMutReason = "notfound" | "forbidden" | "expired";

// ── In-memory fallback (globalThis singleton) ──────────────────────────────────
interface MemComment {
  id: string;
  eventSlug: string;
  deviceId: string;
  authorName: string;
  avatar: string | null;
  text: string;
  editedAt: number | null;
  createdAt: number;
}
const g = globalThis as unknown as { __eventComments?: MemComment[] };
const mem: MemComment[] = (g.__eventComments ??= []);
let seq = 0;
function memId(): string {
  seq += 1;
  return `ec_${Date.now().toString(36)}_${seq}`;
}

function memToView(c: MemComment): EventCommentView {
  return {
    id: c.id,
    deviceId: c.deviceId,
    authorName: c.authorName,
    avatar: c.avatar,
    text: c.text,
    editedAt: c.editedAt ? new Date(c.editedAt).toISOString() : null,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

export async function listEventComments(eventSlug: string): Promise<EventCommentView[]> {
  return withDb(
    async () => {
      const rows = await db.eventCommentMobile.findMany({
        where: { eventSlug },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        authorName: r.authorName,
        avatar: r.avatar ?? null,
        text: r.text,
        editedAt: r.editedAt ? r.editedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    () => mem.filter((c) => c.eventSlug === eventSlug).sort((a, b) => a.createdAt - b.createdAt).map(memToView),
  );
}

export async function addEventComment(input: {
  eventSlug: string;
  deviceId: string;
  authorName: string;
  avatar?: string | null;
  text: string;
}): Promise<EventCommentView> {
  const text = input.text.trim().slice(0, 1000);
  const avatar = input.avatar ?? null;
  return withDb(
    async () => {
      const r = await db.eventCommentMobile.create({
        data: { eventSlug: input.eventSlug, deviceId: input.deviceId, authorName: input.authorName, avatar, text },
      });
      return {
        id: r.id,
        deviceId: r.deviceId,
        authorName: r.authorName,
        avatar: r.avatar ?? null,
        text: r.text,
        editedAt: null,
        createdAt: r.createdAt.toISOString(),
      };
    },
    () => {
      const c: MemComment = {
        id: memId(),
        eventSlug: input.eventSlug,
        deviceId: input.deviceId,
        authorName: input.authorName,
        avatar,
        text,
        editedAt: null,
        createdAt: Date.now(),
      };
      mem.push(c);
      return memToView(c);
    },
  );
}

export interface CommentEditResult {
  ok: boolean;
  reason?: CommentMutReason;
  comment?: EventCommentView;
}

export async function editEventComment(input: {
  id: string;
  deviceId: string;
  text: string;
}): Promise<CommentEditResult> {
  const text = input.text.trim().slice(0, 1000);
  return withDb(
    async () => {
      const existing = await db.eventCommentMobile.findUnique({ where: { id: input.id } });
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt.getTime() > EVENT_COMMENT_EDIT_WINDOW_MS)
        return { ok: false, reason: "expired" as const };
      const r = await db.eventCommentMobile.update({ where: { id: input.id }, data: { text, editedAt: new Date() } });
      return {
        ok: true,
        comment: {
          id: r.id,
          deviceId: r.deviceId,
          authorName: r.authorName,
          avatar: r.avatar ?? null,
          text: r.text,
          editedAt: r.editedAt ? r.editedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        },
      };
    },
    () => {
      const existing = mem.find((c) => c.id === input.id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt > EVENT_COMMENT_EDIT_WINDOW_MS) return { ok: false, reason: "expired" as const };
      existing.text = text;
      existing.editedAt = Date.now();
      return { ok: true, comment: memToView(existing) };
    },
  );
}

export async function deleteEventComment(input: {
  id: string;
  deviceId: string;
  isAdmin?: boolean;
}): Promise<{ ok: boolean; reason?: CommentMutReason }> {
  return withDb(
    async () => {
      const existing = await db.eventCommentMobile.findUnique({ where: { id: input.id } });
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (!input.isAdmin && existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      await db.eventCommentMobile.delete({ where: { id: input.id } });
      return { ok: true };
    },
    () => {
      const existing = mem.find((c) => c.id === input.id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (!input.isAdmin && existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      const idx = mem.indexOf(existing);
      if (idx >= 0) mem.splice(idx, 1);
      return { ok: true };
    },
  );
}
