"use server";

import { revalidatePath } from "next/cache";
import { appendMessage, getConversation, markConversationRead } from "./messaging";
import { CURRENT_USERNAME, type Message } from "./messaging-data";
import { isBlocked } from "./safety-actions";
import { publishMessage } from "./messaging-bus";
import { moderateMessage } from "./moderation";
import { pushNotification } from "./notifications-store";
import { auth } from "@/auth";

async function requireSession() {
  const session = await auth().catch(() => null);
  if (!session?.user) return null;
  return session;
}

export interface SerializedMessage {
  id: string;
  senderUsername: string;
  text: string;
  createdAt: string;
  readAt?: string;
}

function serialize(m: Message): SerializedMessage {
  return {
    id: m.id,
    senderUsername: m.senderUsername,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt?.toISOString(),
  };
}

async function tryPushNotify(toUser: string, fromName: string, text: string) {
  try {
    const { sendPush } = await import("./push-server");
    await sendPush(null, {
      title: `💬 ${fromName}`,
      body: text.length > 100 ? text.slice(0, 97) + "…" : text,
      url: `/mesaj/${toUser}`,
    });
  } catch {
    // VAPID/push yapılandırılmamışsa sessizce geç
  }
}

export async function sendMessageAction(
  username: string,
  text: string,
): Promise<{ ok: boolean; message?: SerializedMessage; error?: string }> {
  const session = await requireSession();
  if (!session) {
    return { ok: false, error: "Mesaj göndermek için giriş yapmalısın" };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Mesaj boş olamaz" };
  if (await isBlocked(username)) {
    return { ok: false, error: "Engellediğin kullanıcıya mesaj gönderemezsin" };
  }
  const mod = moderateMessage(session.user?.email ?? "anon", trimmed);
  if (!mod.ok) {
    return { ok: false, error: mod.message ?? "Mesaj reddedildi" };
  }
  const msg = await appendMessage(username, trimmed, CURRENT_USERNAME);
  const serialized = serialize(msg);
  publishMessage(username, serialized);

  // Alıcıya in-app bildirim — kendine mesaj atılmıyorsa
  const fromName = session.user?.name ?? "Biri";
  if (username !== CURRENT_USERNAME) {
    await pushNotification({
      userEmail: username,
      type: "message",
      title: `💬 ${fromName}`,
      body: trimmed.length > 100 ? trimmed.slice(0, 97) + "…" : trimmed,
      url: `/mesaj/${CURRENT_USERNAME}`,
      fromName,
      fromColor: "#7c3aed",
    });
  }

  // Web push de fire et (configure'liyse)
  void tryPushNotify(username, fromName, trimmed);

  revalidatePath(`/mesaj/${username}`);
  revalidatePath("/mesaj");
  return { ok: true, message: serialized };
}

export async function fetchConversationAction(
  username: string,
): Promise<{ messages: SerializedMessage[] }> {
  const c = await getConversation(username);
  if (!c) return { messages: [] };
  return { messages: c.messages.map(serialize) };
}

export async function markReadAction(username: string): Promise<{ ok: true }> {
  await markConversationRead(username);
  revalidatePath("/mesaj");
  return { ok: true };
}
