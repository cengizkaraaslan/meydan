import "server-only";
import { db } from "./db";
import { withDb } from "./db-fallback";
import { profileSlugFromEmail } from "./social-data";

export interface GalleryPhoto {
  id: string;
  eventSlug: string;
  uploaderEmail: string;
  uploaderName: string;
  url: string; // R2 public URL
  caption: string;
  createdAt: string; // ISO
  reportCount: number;
}

// -----------------------------------------------------------------------------
// In-memory store (DATABASE_URL yokken VEYA DB hatası olduğunda fallback).
// withDb(): DB yapılandırılmışsa Prisma'yı dener; tablo henüz yoksa / DB hatası
// olursa in-memory'e düşer. Seed yok — galeri fotoğrafları gerçek yüklemelerdir.
// -----------------------------------------------------------------------------
type Store = Map<string, GalleryPhoto[]>;

const g = globalThis as unknown as { __galleryStore?: Store };
g.__galleryStore ??= new Map<string, GalleryPhoto[]>();
const store: Store = g.__galleryStore;

// -----------------------------------------------------------------------------
// DB satırı → GalleryPhoto
// -----------------------------------------------------------------------------
interface GalleryRow {
  id: string;
  eventSlug: string;
  uploaderEmail: string;
  uploaderName: string;
  url: string;
  caption: string;
  reportCount: number;
  createdAt: Date;
}

function rowToPhoto(r: GalleryRow): GalleryPhoto {
  return {
    id: r.id,
    eventSlug: r.eventSlug,
    uploaderEmail: r.uploaderEmail,
    uploaderName: r.uploaderName,
    url: r.url,
    caption: r.caption,
    createdAt: r.createdAt.toISOString(),
    reportCount: r.reportCount,
  };
}

function newId(): string {
  return `gp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addPhoto(input: {
  eventSlug: string;
  uploaderEmail: string;
  uploaderName: string;
  url: string;
  caption: string;
}): Promise<GalleryPhoto> {
  return withDb(
    async () => {
      const r = await db.galleryPhoto.create({
        data: {
          eventSlug: input.eventSlug,
          uploaderEmail: input.uploaderEmail,
          uploaderName: input.uploaderName,
          url: input.url,
          caption: input.caption,
        },
      });
      return rowToPhoto(r);
    },
    () => {
      const photo: GalleryPhoto = {
        id: newId(),
        eventSlug: input.eventSlug,
        uploaderEmail: input.uploaderEmail,
        uploaderName: input.uploaderName,
        url: input.url,
        caption: input.caption,
        createdAt: new Date().toISOString(),
        reportCount: 0,
      };
      const list = store.get(input.eventSlug) ?? [];
      list.push(photo);
      store.set(input.eventSlug, list);
      return photo;
    },
  );
}

export async function listPhotos(slug: string): Promise<GalleryPhoto[]> {
  return withDb(
    async () => {
      const rows = await db.galleryPhoto.findMany({
        where: { eventSlug: slug },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(rowToPhoto);
    },
    () => {
      const list = store.get(slug) ?? [];
      return list
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  );
}

export async function removePhoto(id: string, userEmail: string): Promise<boolean> {
  return withDb(
    async () => {
      // Sadece sahibi silebilir: id + uploaderEmail eşleşmeli.
      const res = await db.galleryPhoto.deleteMany({
        where: { id, uploaderEmail: userEmail },
      });
      return res.count > 0;
    },
    () => {
      for (const [slug, list] of store.entries()) {
        const idx = list.findIndex((p) => p.id === id);
        if (idx === -1) continue;
        if (list[idx].uploaderEmail !== userEmail) return false;
        list.splice(idx, 1);
        if (list.length === 0) store.delete(slug);
        else store.set(slug, list);
        return true;
      }
      return false;
    },
  );
}

/**
 * Bir kullanıcının (profil slug'ına göre) TÜM etkinliklerde paylaştığı fotoğraflar —
 * kişisel "duvar" (Instagram benzeri grid) için. Slug = profileSlugFromEmail(uploaderEmail).
 */
export async function listPhotosByUserSlug(userSlug: string, limit = 60): Promise<GalleryPhoto[]> {
  const match = (email: string) => profileSlugFromEmail(email) === userSlug;
  return withDb(
    async () => {
      // Son 500 fotoğrafı çekip slug'a göre süz (kullanıcı başına ayrı kolon yok).
      const rows = await db.galleryPhoto.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return rows.filter((r) => match(r.uploaderEmail)).slice(0, limit).map(rowToPhoto);
    },
    () => {
      const all: GalleryPhoto[] = [];
      for (const list of store.values()) for (const p of list) if (match(p.uploaderEmail)) all.push(p);
      return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
  );
}

export async function getPhotoCount(slug: string): Promise<number> {
  return withDb(
    () => db.galleryPhoto.count({ where: { eventSlug: slug } }),
    () => store.get(slug)?.length ?? 0,
  );
}
