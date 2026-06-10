"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db, isDbConfigured } from "./db";
import { slugify } from "./utils";
import type { EventCategory } from "./types";

/**
 * Kullanıcının oluşturduğu etkinlikleri Postgres'e (db.event) yazan server action'ları.
 * Eski localStorage tabanlı my-events.ts'in yerini alır — buraya yazılan etkinlik
 * source:"MANUAL" + hidden:false ile HERKESE görünür (bkz. lib/events.ts merge).
 *
 * DB yoksa (isDbConfigured=false) kalıcı yazma yapılamaz; {ok:false} döneriz.
 * (Story'lerdeki in-memory fallback'in aksine manuel etkinliklerin tarayıcılar
 * arası görünmesi DB gerektirir — bu yüzden DB şart.)
 */

export interface CreateEventInput {
  title: string;
  description?: string;
  category: EventCategory;
  city: string;
  venue: string;
  /** ISO string */
  startsAt: string;
  /** ISO string, opsiyonel */
  endsAt?: string;
  isFree: boolean;
  priceMin?: number;
  priceMax?: number;
  ticketUrl?: string;
  imageUrl?: string;
}

export interface CreateEventResult {
  ok: boolean;
  slug?: string;
  error?: string;
}

/** slug için kısa benzersiz ek üretir (id çakışmasını azaltır). */
function shortId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function createEventAction(
  input: CreateEventInput,
): Promise<CreateEventResult> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  const creatorName = session?.user?.name?.trim() || null;
  if (!email) {
    return { ok: false, error: "Etkinlik oluşturmak için giriş yapmalısın" };
  }

  if (!isDbConfigured) {
    return { ok: false, error: "Bu özellik için veritabanı gerekli (DB yapılandırılmamış)" };
  }

  const title = input.title?.trim();
  if (!title || title.length < 3) {
    return { ok: false, error: "Geçerli bir başlık gir" };
  }
  if (!input.venue?.trim() || !input.city?.trim()) {
    return { ok: false, error: "Mekân ve şehir zorunlu" };
  }

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "Geçerli bir başlangıç tarihi gir" };
  }
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return { ok: false, error: "Geçerli bir bitiş tarihi gir" };
  }

  const uid = shortId();
  const slugBase = slugify(title) || "etkinlik";
  const slug = `${slugBase}-${uid.slice(0, 6).toLowerCase()}`;
  const externalId = `manual-${uid}`;

  try {
    const row = await db.event.create({
      data: {
        source: "MANUAL",
        externalId,
        slug,
        title,
        description: input.description?.trim() || null,
        category: input.category,
        venue: input.venue.trim(),
        city: input.city.trim(),
        startsAt,
        endsAt: endsAt ?? null,
        isFree: input.isFree,
        priceMin: !input.isFree && input.priceMin != null ? input.priceMin : null,
        priceMax: !input.isFree && input.priceMax != null ? input.priceMax : null,
        ticketUrl: input.ticketUrl?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        hidden: false,
        featured: false,
        creatorEmail: email,
        creatorName,
        // Düzenleyen = oluşturanın adı (varsa) — etkinlik detayında "Düzenleyen: …" gösterilir.
        organizer: creatorName,
      },
      select: { slug: true },
    });

    // Yeni etkinlik listelerde görünsün
    revalidatePath("/");
    revalidatePath("/etkinlikler");
    revalidatePath("/yayinla/yonetim");

    return { ok: true, slug: row.slug };
  } catch (e) {
    console.error(
      "[event-create-actions] createEvent DB hatası:",
      e instanceof Error ? e.message : e,
    );
    return { ok: false, error: "Etkinlik kaydedilemedi. Lütfen tekrar dene." };
  }
}

export interface MyEventRow {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  city: string;
  venue: string;
  /** ISO string */
  startsAt: string;
  isFree: boolean;
  priceMin?: number;
  priceMax?: number;
  imageUrl?: string;
  hidden: boolean;
  /** ISO string */
  createdAt: string;
}

/** Oturum sahibinin oluşturduğu etkinlikleri en yeni → eski döndürür (yönetim sayfası). */
export async function listMyEventsAction(): Promise<MyEventRow[]> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  if (!email || !isDbConfigured) return [];

  try {
    const rows = await db.event.findMany({
      where: { creatorEmail: email },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        city: true,
        venue: true,
        startsAt: true,
        isFree: true,
        priceMin: true,
        priceMax: true,
        imageUrl: true,
        hidden: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category as EventCategory,
      city: r.city,
      venue: r.venue,
      startsAt: r.startsAt.toISOString(),
      isFree: r.isFree,
      priceMin: r.priceMin ?? undefined,
      priceMax: r.priceMax ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      hidden: r.hidden,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (e) {
    console.error(
      "[event-create-actions] listMyEvents DB hatası:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

/** Sadece etkinliğin sahibi (creatorEmail===me) silebilir. */
export async function deleteMyEventAction(
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  if (!email) return { ok: false, error: "Giriş gerekli" };
  if (!isDbConfigured) return { ok: false, error: "DB gerekli" };

  try {
    const res = await db.event.deleteMany({
      where: { slug, creatorEmail: email },
    });
    if (res.count === 0) {
      return { ok: false, error: "Etkinlik bulunamadı veya silme yetkin yok" };
    }
    revalidatePath("/");
    revalidatePath("/etkinlikler");
    revalidatePath("/yayinla/yonetim");
    return { ok: true };
  } catch (e) {
    console.error(
      "[event-create-actions] deleteMyEvent DB hatası:",
      e instanceof Error ? e.message : e,
    );
    return { ok: false, error: "Etkinlik silinemedi" };
  }
}
