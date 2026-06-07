"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  addCheckIn,
  getCheckInCountForEvent,
  hasCheckedIn,
  listCheckInsForEvent,
  removeCheckIn,
  type CheckIn,
} from "./checkin-store";
import { getEventBySlug } from "./events";
import { pushNotification } from "./notifications-store";

export interface CheckInResult {
  ok: boolean;
  checkIn?: CheckIn;
  count?: number;
  error?: string;
}

export async function checkInAction(
  slug: string,
  mood?: string,
): Promise<CheckInResult> {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return { ok: false, error: "Buradayım demek için giriş yapmalısın" };
  }
  const event = await getEventBySlug(slug);
  if (!event) return { ok: false, error: "Etkinlik bulunamadı" };

  const email = session.user.email ?? "anon";
  const name = session.user.name ?? "Sen";

  if (await hasCheckedIn(email, slug)) {
    return {
      ok: false,
      error: "Zaten check-in yaptın",
      count: await getCheckInCountForEvent(slug),
    };
  }

  const ci = await addCheckIn({
    userEmail: email,
    userName: name,
    userAvatarUrl: session.user.image ?? undefined,
    userColor: "#6366f1",
    eventSlug: slug,
    eventTitle: event.title,
    city: event.city,
    mood,
  });

  // Etkinliğe önceden check-in yapan diğer kullanıcılara bildirim
  const others = (await listCheckInsForEvent(slug)).filter(
    (c) => c.userEmail !== email,
  );
  for (const other of others.slice(0, 5)) {
    await pushNotification({
      userEmail: other.userEmail,
      type: "event_update",
      title: `🎉 ${name} de etkinlikte`,
      body: `${event.title} — yanına gel!`,
      url: `/etkinlik/${slug}`,
      fromName: name,
      fromColor: "#6366f1",
    });
  }

  revalidatePath(`/etkinlik/${slug}`);
  return {
    ok: true,
    checkIn: ci,
    count: await getCheckInCountForEvent(slug),
  };
}

export async function removeCheckInAction(
  slug: string,
): Promise<CheckInResult> {
  const session = await auth().catch(() => null);
  if (!session?.user) return { ok: false, error: "Giriş gerekli" };
  const email = session.user.email ?? "anon";
  const ok = await removeCheckIn(email, slug);
  revalidatePath(`/etkinlik/${slug}`);
  return { ok, count: await getCheckInCountForEvent(slug) };
}

export async function listCheckInsAction(slug: string): Promise<{
  items: CheckIn[];
  count: number;
  mine: boolean;
}> {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? "anon";
  const items = await listCheckInsForEvent(slug);
  return {
    items,
    count: items.length,
    mine: await hasCheckedIn(email, slug),
  };
}
