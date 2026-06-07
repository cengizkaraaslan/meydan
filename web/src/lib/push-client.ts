"use client";

import type { EventCategory } from "./types";

export type PushPermissionStatus = "default" | "granted" | "denied" | "unsupported";

export function getPushStatus(): PushPermissionStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission as Exclude<PushPermissionStatus, "unsupported">;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

export async function subscribeToPush(
  categories: EventCategory[] = [],
): Promise<PushSubscription | null> {
  if (getPushStatus() === "unsupported") return null;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[push-client] NEXT_PUBLIC_VAPID_PUBLIC_KEY tanımlı değil");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), categories }),
  });

  return sub;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (getPushStatus() === "unsupported") return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export async function updateCategoryPreferences(categories: EventCategory[]): Promise<void> {
  if (getPushStatus() === "unsupported") return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), categories }),
  });
}
