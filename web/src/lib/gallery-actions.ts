"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getRsvp } from "./rsvp-store";
import { moderateMessage } from "./moderation";
import {
  addPhoto,
  removePhoto,
  type GalleryPhoto,
} from "./gallery-store";

const MAX_CAPTION_LEN = 280;

async function hasGoingRsvp(email: string, slug: string): Promise<boolean> {
  const rsvp = await getRsvp(email, slug);
  return rsvp?.status === "GOING" || rsvp?.status === "MAYBE";
}

export async function addPhotoAction(
  slug: string,
  url: string,
  caption: string,
): Promise<{ ok: boolean; photo?: GalleryPhoto; error?: string }> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  if (!email) {
    return { ok: false, error: "Foto yüklemek için giriş yapmalısın" };
  }

  if (!(await hasGoingRsvp(email, slug))) {
    return {
      ok: false,
      error: "Foto yüklemek için önce etkinliğe katılıyorum demelisin",
    };
  }

  // http(s)://... veya /api/r2-image/... (proxy) kabul et
  if (
    !url ||
    typeof url !== "string" ||
    (!/^https?:\/\//i.test(url) && !url.startsWith("/api/"))
  ) {
    return { ok: false, error: "Geçersiz görsel URL'si" };
  }

  const trimmedCaption = (caption ?? "").trim();
  if (trimmedCaption.length > MAX_CAPTION_LEN) {
    return { ok: false, error: `Açıklama en fazla ${MAX_CAPTION_LEN} karakter olabilir` };
  }

  // Caption boşsa moderation'ı atla (boş açıklama meşrudur).
  if (trimmedCaption.length > 0) {
    const mod = moderateMessage(email, trimmedCaption);
    if (!mod.ok) {
      return { ok: false, error: mod.message ?? "Açıklama reddedildi" };
    }
  }

  const photo = await addPhoto({
    eventSlug: slug,
    uploaderEmail: email,
    uploaderName: session?.user?.name?.trim() || email.split("@")[0],
    url,
    caption: trimmedCaption,
  });

  revalidatePath(`/etkinlik/${slug}`);
  return { ok: true, photo };
}

export async function removePhotoAction(
  slug: string,
  photoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  if (!email) {
    return { ok: false, error: "Silmek için giriş yapmalısın" };
  }

  const ok = await removePhoto(photoId, email);
  if (!ok) {
    return { ok: false, error: "Foto bulunamadı veya silme yetkin yok" };
  }
  revalidatePath(`/etkinlik/${slug}`);
  return { ok: true };
}
