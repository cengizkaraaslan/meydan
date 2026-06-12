import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";

export interface StoredComment {
  id: string;
  eventSlug: string;
  authorUsername: string;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  likes: Set<string>; // user emails / usernames who liked
}

interface CommentStoreShape {
  byEvent: Map<string, StoredComment[]>;
}

const g = globalThis as unknown as { __commentsStore?: CommentStoreShape };
g.__commentsStore ??= { byEvent: new Map() };
const store = g.__commentsStore;

function seedFor(slug: string): StoredComment[] {
  const now = Date.now();
  return [
    {
      id: `seed-${slug}-1`,
      eventSlug: slug,
      authorUsername: "ahmet",
      authorName: "Ahmet K.",
      authorColor: "#7c3aed",
      text: "Bilet aldım! Sahne yerleşimi nasıl, bilen var mı?",
      createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
      parentId: null,
      likes: new Set(),
    },
    {
      id: `seed-${slug}-2`,
      eventSlug: slug,
      authorUsername: "elif",
      authorName: "Elif S.",
      authorColor: "#f59e0b",
      text: "Geçen sene de gitmiştim, ses çok iyiydi. Tavsiye ederim 🎶",
      createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      parentId: null,
      likes: new Set(["ahmet@demo"]),
    },
    {
      id: `seed-${slug}-3`,
      eventSlug: slug,
      authorUsername: "burak",
      authorName: "Burak D.",
      authorColor: "#10b981",
      text: "Otopark sorunu oluyor genelde, metroyla gidiyoruz.",
      createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
      parentId: null,
      likes: new Set(),
    },
  ];
}

export interface SerializedComment {
  id: string;
  authorUsername: string;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
}

function serialize(c: StoredComment, viewerId: string): SerializedComment {
  return {
    id: c.id,
    authorUsername: c.authorUsername,
    authorName: c.authorName,
    authorColor: c.authorColor,
    text: c.text,
    createdAt: c.createdAt,
    parentId: c.parentId,
    likeCount: c.likes.size,
    likedByMe: viewerId ? c.likes.has(viewerId) : false,
  };
}

function ensureSeed(slug: string): StoredComment[] {
  let list = store.byEvent.get(slug);
  if (!list) {
    list = seedFor(slug);
    store.byEvent.set(slug, list);
  }
  return list;
}

// -----------------------------------------------------------------------------
// DB satırı → StoredComment. likes ilişkisindeki CommentLike satırlarından
// viewerId'leri Set'e map'ler.
// -----------------------------------------------------------------------------
interface CommentRow {
  id: string;
  eventSlug: string;
  authorUsername: string;
  authorName: string;
  authorColor: string;
  text: string;
  parentId: string | null;
  createdAt: Date;
  likes?: { viewerId: string }[];
}

function rowToStored(r: CommentRow): StoredComment {
  return {
    id: r.id,
    eventSlug: r.eventSlug,
    authorUsername: r.authorUsername,
    authorName: r.authorName,
    authorColor: r.authorColor,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
    parentId: r.parentId,
    likes: new Set((r.likes ?? []).map((l) => l.viewerId)),
  };
}

export async function listComments(slug: string, viewerId: string): Promise<SerializedComment[]> {
  return withDb(
    async () => {
      const rows = await db.eventComment.findMany({
        where: { eventSlug: slug },
        include: { likes: true },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => serialize(rowToStored(r), viewerId));
    },
    () => {
      const list = ensureSeed(slug);
      return list
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => serialize(c, viewerId));
    },
  );
}

export async function addComment(input: {
  slug: string;
  authorUsername: string;
  authorName: string;
  authorColor: string;
  text: string;
  parentId: string | null;
}): Promise<SerializedComment> {
  return withDb(
    async () => {
      const r = await db.eventComment.create({
        data: {
          eventSlug: input.slug,
          authorUsername: input.authorUsername,
          authorName: input.authorName,
          authorColor: input.authorColor,
          text: input.text,
          parentId: input.parentId,
        },
        include: { likes: true },
      });
      return serialize(rowToStored(r), input.authorUsername);
    },
    () => {
      const list = ensureSeed(input.slug);
      const comment: StoredComment = {
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        eventSlug: input.slug,
        authorUsername: input.authorUsername,
        authorName: input.authorName,
        authorColor: input.authorColor,
        text: input.text,
        createdAt: new Date().toISOString(),
        parentId: input.parentId,
        likes: new Set(),
      };
      list.push(comment);
      return serialize(comment, input.authorUsername);
    },
  );
}

export async function toggleLike(
  slug: string,
  commentId: string,
  viewerId: string,
): Promise<SerializedComment | null> {
  return withDb(
    async () => {
      const existing = await db.commentLike.findUnique({
        where: { commentId_viewerId: { commentId, viewerId } },
        select: { id: true },
      });
      if (existing) {
        await db.commentLike.delete({ where: { id: existing.id } });
      } else {
        await db.commentLike.create({ data: { commentId, viewerId } });
      }
      const r = await db.eventComment.findUnique({
        where: { id: commentId },
        include: { likes: true },
      });
      if (!r) return null;
      return serialize(rowToStored(r), viewerId);
    },
    () => {
      const list = ensureSeed(slug);
      const c = list.find((x) => x.id === commentId);
      if (!c) return null;
      if (c.likes.has(viewerId)) c.likes.delete(viewerId);
      else c.likes.add(viewerId);
      return serialize(c, viewerId);
    },
  );
}

export async function findComment(slug: string, commentId: string): Promise<StoredComment | null> {
  return withDb(
    async () => {
      const r = await db.eventComment.findUnique({
        where: { id: commentId },
        include: { likes: true },
      });
      if (!r) return null;
      return rowToStored(r);
    },
    () => {
      const list = ensureSeed(slug);
      return list.find((c) => c.id === commentId) ?? null;
    },
  );
}

/**
 * Yorumu (ve altındaki tüm cevap zincirini) siler. Beğeniler CommentLike.onDelete:Cascade
 * ile otomatik temizlenir. Silinen tüm id'leri döner → istemci optimistic kaldırmayı
 * sunucuyla aynı kümeye uzlaştırır. Sahiplik kontrolü çağıran action katmanında yapılır.
 */
export async function deleteComment(slug: string, commentId: string): Promise<string[]> {
  return withDb(
    async () => {
      const toDelete = [commentId];
      let frontier = [commentId];
      // Derinlik küçük (en çok 2); parentId zincirinden alt cevapları topla.
      while (frontier.length) {
        const children = await db.eventComment.findMany({
          where: { parentId: { in: frontier } },
          select: { id: true },
        });
        const ids = children.map((c) => c.id);
        if (ids.length === 0) break;
        toDelete.push(...ids);
        frontier = ids;
      }
      await db.eventComment.deleteMany({ where: { id: { in: toDelete } } });
      return toDelete;
    },
    () => {
      const list = ensureSeed(slug);
      const toDelete = new Set<string>([commentId]);
      let added = true;
      while (added) {
        added = false;
        for (const c of list) {
          if (c.parentId && toDelete.has(c.parentId) && !toDelete.has(c.id)) {
            toDelete.add(c.id);
            added = true;
          }
        }
      }
      store.byEvent.set(slug, list.filter((c) => !toDelete.has(c.id)));
      return [...toDelete];
    },
  );
}
