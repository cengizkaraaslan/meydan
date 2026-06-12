import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

/**
 * Etkinlik detay yorumları — deviceId bazlı, sunucu kaynaklı (tüm cihazlarda ortak).
 * EventCommentMobile + EventCommentReaction tablolarını kullanır; tablo yoksa/DB
 * hatasında in-memory'e düşer. Yorumlar etkileşime göre sıralı döner (Instagram tarzı):
 * (reaction toplamı + yanıt sayısı) azalan, eşitlikte yeni üstte.
 */

/** Yorum düzenleme penceresi (gönderimden sonra 2 dk) — eski mobil davranışıyla aynı. */
export const EVENT_COMMENT_EDIT_WINDOW_MS = 2 * 60 * 1000;

export interface EventCommentReplyTo {
  id: string;
  authorName: string;
  snippet: string; // alıntılanan yorumun kısa özeti
}

export interface EventCommentView {
  id: string;
  deviceId: string;
  authorName: string;
  avatar: string | null;
  text: string;
  replyTo: EventCommentReplyTo | null; // bu yorum bir yanıtsa alıntı özeti
  reactions: Record<string, number>; // emoji -> sayı
  reactionTotal: number;
  myReaction: string | null; // bakan cihazın tepkisi
  replyCount: number; // bu yoruma verilen yanıt sayısı
  editedAt: string | null; // ISO
  createdAt: string; // ISO
}

export type CommentMutReason = "notfound" | "forbidden" | "expired";

/** Alıntı önizleme metni (boşluk sadeleştir, ~80 karakter). */
function snippetOf(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 80 ? t.slice(0, 80) + "…" : t;
}

/** Etkileşime göre azalan sırala; eşitlikte yeni olan üstte (Instagram "en popüler"). */
function sortByEngagement(views: EventCommentView[]): EventCommentView[] {
  return views.sort((a, b) => {
    const sb = b.reactionTotal + b.replyCount;
    const sa = a.reactionTotal + a.replyCount;
    if (sb !== sa) return sb - sa;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ── In-memory fallback (globalThis singleton) ──────────────────────────────────
interface MemComment {
  id: string;
  eventSlug: string;
  deviceId: string;
  authorName: string;
  avatar: string | null;
  text: string;
  replyToId: string | null;
  editedAt: number | null;
  createdAt: number;
}
interface MemReaction {
  commentId: string;
  deviceId: string;
  emoji: string;
}
const g = globalThis as unknown as { __eventComments?: MemComment[]; __eventCommentReactions?: MemReaction[] };
const mem: MemComment[] = (g.__eventComments ??= []);
const memReactions: MemReaction[] = (g.__eventCommentReactions ??= []);
let seq = 0;
function memId(): string {
  seq += 1;
  return `ec_${Date.now().toString(36)}_${seq}`;
}

function memReactionInfo(commentId: string, viewer?: string) {
  const reactions: Record<string, number> = {};
  let total = 0;
  let myReaction: string | null = null;
  for (const r of memReactions) {
    if (r.commentId !== commentId) continue;
    reactions[r.emoji] = (reactions[r.emoji] ?? 0) + 1;
    total += 1;
    if (viewer && r.deviceId === viewer) myReaction = r.emoji;
  }
  return { reactions, reactionTotal: total, myReaction };
}

function memToView(c: MemComment, viewer?: string): EventCommentView {
  const target = c.replyToId ? mem.find((x) => x.id === c.replyToId) : null;
  const replyCount = mem.filter((x) => x.replyToId === c.id).length;
  return {
    id: c.id,
    deviceId: c.deviceId,
    authorName: c.authorName,
    avatar: c.avatar,
    text: c.text,
    replyTo: target ? { id: target.id, authorName: target.authorName, snippet: snippetOf(target.text) } : null,
    ...memReactionInfo(c.id, viewer),
    replyCount,
    editedAt: c.editedAt ? new Date(c.editedAt).toISOString() : null,
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

// ── DB yolu yardımcıları ───────────────────────────────────────────────────────
type DbComment = {
  id: string;
  deviceId: string;
  authorName: string;
  avatar: string | null;
  text: string;
  replyToId: string | null;
  editedAt: Date | null;
  createdAt: Date;
};

/** Tek bir yorum satırını (reaction + yanıt sayısı + alıntı özetiyle) view'a çevirir. */
async function dbBuildView(r: DbComment, viewerDeviceId: string): Promise<EventCommentView> {
  const [grouped, mineRow, replyCount, target] = await Promise.all([
    db.eventCommentReaction.groupBy({ by: ["emoji"], where: { commentId: r.id }, _count: { _all: true } }),
    viewerDeviceId
      ? db.eventCommentReaction.findUnique({ where: { commentId_deviceId: { commentId: r.id, deviceId: viewerDeviceId } } })
      : Promise.resolve(null),
    db.eventCommentMobile.count({ where: { replyToId: r.id } }),
    r.replyToId ? db.eventCommentMobile.findUnique({ where: { id: r.replyToId } }) : Promise.resolve(null),
  ]);
  const reactions: Record<string, number> = {};
  let reactionTotal = 0;
  for (const grp of grouped) {
    reactions[grp.emoji] = grp._count._all;
    reactionTotal += grp._count._all;
  }
  return {
    id: r.id,
    deviceId: r.deviceId,
    authorName: r.authorName,
    avatar: r.avatar ?? null,
    text: r.text,
    replyTo: target ? { id: target.id, authorName: target.authorName, snippet: snippetOf(target.text) } : null,
    reactions,
    reactionTotal,
    myReaction: mineRow?.emoji ?? null,
    replyCount,
    editedAt: r.editedAt ? r.editedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listEventComments(eventSlug: string, viewerDeviceId = ""): Promise<EventCommentView[]> {
  return withDb(
    async () => {
      const rows = await db.eventCommentMobile.findMany({ where: { eventSlug }, orderBy: { createdAt: "asc" } });
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const [grouped, mine] = await Promise.all([
        db.eventCommentReaction.groupBy({ by: ["commentId", "emoji"], where: { commentId: { in: ids } }, _count: { _all: true } }),
        viewerDeviceId
          ? db.eventCommentReaction.findMany({ where: { commentId: { in: ids }, deviceId: viewerDeviceId } })
          : Promise.resolve([] as { commentId: string; emoji: string }[]),
      ]);
      const reactionMap = new Map<string, Record<string, number>>();
      const totalMap = new Map<string, number>();
      for (const grp of grouped) {
        const m = reactionMap.get(grp.commentId) ?? {};
        m[grp.emoji] = grp._count._all;
        reactionMap.set(grp.commentId, m);
        totalMap.set(grp.commentId, (totalMap.get(grp.commentId) ?? 0) + grp._count._all);
      }
      const myMap = new Map(mine.map((r) => [r.commentId, r.emoji]));
      const replyCountMap = new Map<string, number>();
      for (const r of rows) if (r.replyToId) replyCountMap.set(r.replyToId, (replyCountMap.get(r.replyToId) ?? 0) + 1);

      const views: EventCommentView[] = rows.map((r) => {
        const target = r.replyToId ? byId.get(r.replyToId) : null;
        return {
          id: r.id,
          deviceId: r.deviceId,
          authorName: r.authorName,
          avatar: r.avatar ?? null,
          text: r.text,
          replyTo: target ? { id: target.id, authorName: target.authorName, snippet: snippetOf(target.text) } : null,
          reactions: reactionMap.get(r.id) ?? {},
          reactionTotal: totalMap.get(r.id) ?? 0,
          myReaction: myMap.get(r.id) ?? null,
          replyCount: replyCountMap.get(r.id) ?? 0,
          editedAt: r.editedAt ? r.editedAt.toISOString() : null,
          createdAt: r.createdAt.toISOString(),
        };
      });
      return sortByEngagement(views);
    },
    () => sortByEngagement(mem.filter((c) => c.eventSlug === eventSlug).map((c) => memToView(c, viewerDeviceId))),
  );
}

export async function addEventComment(input: {
  eventSlug: string;
  deviceId: string;
  authorName: string;
  avatar?: string | null;
  text: string;
  replyToId?: string | null;
}): Promise<EventCommentView> {
  const text = input.text.trim().slice(0, 1000);
  const avatar = input.avatar ?? null;
  const replyToId = input.replyToId ?? null;
  return withDb(
    async () => {
      const r = await db.eventCommentMobile.create({
        data: { eventSlug: input.eventSlug, deviceId: input.deviceId, authorName: input.authorName, avatar, text, replyToId },
      });
      return dbBuildView(r, input.deviceId);
    },
    () => {
      const c: MemComment = {
        id: memId(),
        eventSlug: input.eventSlug,
        deviceId: input.deviceId,
        authorName: input.authorName,
        avatar,
        text,
        replyToId,
        editedAt: null,
        createdAt: Date.now(),
      };
      mem.push(c);
      return memToView(c, input.deviceId);
    },
  );
}

/** Yorumun yanıtladığı yorumun sahibinin deviceId'si (reply bildirimi için). Yoksa null. */
export async function eventCommentReplyTargetOwner(replyToId: string): Promise<string | null> {
  return withDb(
    async () => {
      const t = await db.eventCommentMobile.findUnique({ where: { id: replyToId }, select: { deviceId: true } });
      return t?.deviceId ?? null;
    },
    () => mem.find((c) => c.id === replyToId)?.deviceId ?? null,
  );
}

/** Bir yoruma emoji tepki ekle/değiştir/kaldır (kişi başına tek; aynı emoji tekrar → kaldırır). */
export async function reactToEventComment(input: {
  commentId: string;
  deviceId: string;
  emoji: string;
}): Promise<{ myReaction: string | null }> {
  const { commentId, deviceId, emoji } = input;
  return withDb(
    async () => {
      const existing = await db.eventCommentReaction.findUnique({ where: { commentId_deviceId: { commentId, deviceId } } });
      if (existing && existing.emoji === emoji) {
        await db.eventCommentReaction.delete({ where: { commentId_deviceId: { commentId, deviceId } } });
        return { myReaction: null };
      }
      await db.eventCommentReaction.upsert({
        where: { commentId_deviceId: { commentId, deviceId } },
        create: { commentId, deviceId, emoji },
        update: { emoji },
      });
      return { myReaction: emoji };
    },
    () => {
      const idx = memReactions.findIndex((r) => r.commentId === commentId && r.deviceId === deviceId);
      if (idx >= 0 && memReactions[idx].emoji === emoji) {
        memReactions.splice(idx, 1);
        return { myReaction: null };
      }
      if (idx >= 0) memReactions[idx].emoji = emoji;
      else memReactions.push({ commentId, deviceId, emoji });
      return { myReaction: emoji };
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
      return { ok: true, comment: await dbBuildView(r, input.deviceId) };
    },
    () => {
      const existing = mem.find((c) => c.id === input.id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      if (Date.now() - existing.createdAt > EVENT_COMMENT_EDIT_WINDOW_MS) return { ok: false, reason: "expired" as const };
      existing.text = text;
      existing.editedAt = Date.now();
      return { ok: true, comment: memToView(existing, input.deviceId) };
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
      // Tepkileri temizle + bu yoruma yapılan yanıtları "kök"e çevir (alıntı kaybolur, yanıt kalır).
      await db.eventCommentReaction.deleteMany({ where: { commentId: input.id } });
      await db.eventCommentMobile.updateMany({ where: { replyToId: input.id }, data: { replyToId: null } });
      await db.eventCommentMobile.delete({ where: { id: input.id } });
      return { ok: true };
    },
    () => {
      const existing = mem.find((c) => c.id === input.id);
      if (!existing) return { ok: false, reason: "notfound" as const };
      if (!input.isAdmin && existing.deviceId !== input.deviceId) return { ok: false, reason: "forbidden" as const };
      for (let i = memReactions.length - 1; i >= 0; i--) if (memReactions[i].commentId === input.id) memReactions.splice(i, 1);
      for (const c of mem) if (c.replyToId === input.id) c.replyToId = null;
      const idx = mem.indexOf(existing);
      if (idx >= 0) mem.splice(idx, 1);
      return { ok: true };
    },
  );
}
