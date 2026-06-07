"use server";

import { revalidatePath } from "next/cache";
import {
  appendRoomMessage,
  CURRENT_USERNAME,
  getRoomMessages,
  type EventChatMessage,
} from "./event-chat-store";
import { publishEventChat } from "./event-chat-bus";
import { moderateMessage } from "./moderation";
import { auth } from "@/auth";

interface SendResult {
  ok: boolean;
  message?: EventChatMessage;
  error?: string;
}

const MAX_LEN = 1000;

export async function sendEventMessage(
  slug: string,
  text: string,
  author?: { name?: string; color?: string },
): Promise<SendResult> {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return { ok: false, error: "Sohbete yazmak için giriş yapmalısın" };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Mesaj boş olamaz" };
  if (trimmed.length > MAX_LEN) {
    return { ok: false, error: "Mesaj çok uzun" };
  }
  const mod = moderateMessage(session.user?.email ?? "anon", trimmed);
  if (!mod.ok) {
    return { ok: false, error: mod.message ?? "Mesaj reddedildi" };
  }
  const slugKey = slug.trim().toLowerCase();
  if (!slugKey) return { ok: false, error: "Etkinlik bulunamadı" };

  const msg: EventChatMessage = {
    id: `${slugKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderUsername: CURRENT_USERNAME,
    senderName: author?.name?.trim() || "Sen",
    senderColor: author?.color || "#7c3aed",
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  await appendRoomMessage(slugKey, msg);
  publishEventChat(slugKey, msg);
  revalidatePath(`/etkinlik/${slugKey}/sohbet`);
  return { ok: true, message: msg };
}

export async function fetchEventMessages(
  slug: string,
): Promise<{ messages: EventChatMessage[] }> {
  return { messages: await getRoomMessages(slug) };
}
