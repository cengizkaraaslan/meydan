"use server";

import { revalidatePath } from "next/cache";
import { addComment, findComment, listComments, toggleLike, type SerializedComment } from "./comments-store";
import { moderateMessage } from "./moderation";
import { pushNotification } from "./notifications-store";
import { getEventBySlug } from "./events";
import { auth } from "@/auth";

function viewerIdFromSession(session: { user?: { email?: string | null; name?: string | null } } | null): string {
  return session?.user?.email ?? "anon";
}

export async function listCommentsAction(slug: string): Promise<{ items: SerializedComment[] }> {
  const session = await auth().catch(() => null);
  return { items: await listComments(slug, viewerIdFromSession(session)) };
}

export async function addCommentAction(
  slug: string,
  text: string,
  parentId: string | null,
): Promise<{ ok: boolean; comment?: SerializedComment; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return { ok: false, error: "Yorum yapmak için giriş yapmalısın" };
  }
  const viewerId = viewerIdFromSession(session);
  const mod = moderateMessage(viewerId, text);
  if (!mod.ok) {
    return { ok: false, error: mod.message ?? "Yorum reddedildi" };
  }
  const name = session.user.name?.trim() || "Sen";
  const comment = await addComment({
    slug,
    authorUsername: viewerId,
    authorName: name,
    authorColor: "#6366f1",
    text: text.trim(),
    parentId,
  });

  // Cevap ise parent yazarına bildirim — kendine cevap atıyorsa atla
  if (parentId) {
    const parent = await findComment(slug, parentId);
    if (parent && parent.authorUsername !== viewerId) {
      const event = await getEventBySlug(slug);
      await pushNotification({
        userEmail: parent.authorUsername,
        type: "comment_reply",
        title: `${name} yorumuna cevap verdi`,
        body:
          text.length > 100 ? text.slice(0, 97) + "…" : text,
        url: `/etkinlik/${slug}`,
        fromName: name,
        fromColor: "#6366f1",
      });
      // Future: web push de fire et — şimdilik sadece in-app notif
      void event;
    }
  }

  revalidatePath(`/etkinlik/${slug}`);
  return { ok: true, comment };
}

export async function toggleLikeAction(
  slug: string,
  commentId: string,
): Promise<{ ok: boolean; comment?: SerializedComment; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return { ok: false, error: "Beğenmek için giriş yapmalısın" };
  }
  const viewerId = viewerIdFromSession(session);
  const target = await findComment(slug, commentId);
  const wasLiked = target?.likes.has(viewerId) ?? false;

  const updated = await toggleLike(slug, commentId, viewerId);
  if (!updated) return { ok: false, error: "Yorum bulunamadı" };

  // Yeni beğeni ise yazara bildirim (kendisininkini beğeniyorsa atla)
  if (!wasLiked && target && target.authorUsername !== viewerId) {
    const name = session.user.name?.trim() || "Biri";
    await pushNotification({
      userEmail: target.authorUsername,
      type: "comment_like",
      title: `${name} yorumunu beğendi`,
      body: target.text.length > 80 ? target.text.slice(0, 77) + "…" : target.text,
      url: `/etkinlik/${slug}`,
      fromName: name,
      fromColor: "#ec4899",
    });
  }

  return { ok: true, comment: updated };
}
