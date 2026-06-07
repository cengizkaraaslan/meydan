"use server";

import { revalidatePath } from "next/cache";
import {
  listNotifications,
  markAllRead,
  markRead,
  removeNotification,
  unreadCount,
  type Notification,
} from "./notifications-store";
import { auth } from "@/auth";

async function getUserEmail(): Promise<string | null> {
  const session = await auth().catch(() => null);
  return session?.user?.email ?? null;
}

export async function fetchNotificationsAction(): Promise<{
  items: Notification[];
  unread: number;
}> {
  const email = await getUserEmail();
  if (!email) return { items: [], unread: 0 };
  const [items, unread] = await Promise.all([
    listNotifications(email, 20),
    unreadCount(email),
  ]);
  return { items, unread };
}

export async function markReadAction(id: string): Promise<{ ok: boolean }> {
  const email = await getUserEmail();
  if (!email) return { ok: false };
  return { ok: await markRead(email, id) };
}

export async function markAllReadAction(): Promise<{ ok: boolean; count: number }> {
  const email = await getUserEmail();
  if (!email) return { ok: false, count: 0 };
  const count = await markAllRead(email);
  revalidatePath("/", "layout");
  return { ok: true, count };
}

export async function dismissNotificationAction(id: string): Promise<{ ok: boolean }> {
  const email = await getUserEmail();
  if (!email) return { ok: false };
  return { ok: await removeNotification(email, id) };
}
