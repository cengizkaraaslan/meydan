import "server-only";
import type { SerializedMessage } from "./messaging-actions";

/**
 * In-memory mesaj pub/sub. globalThis singleton (Next.js RSC sandbox sorununa çözüm).
 *
 * Anahtar = karşı tarafın username'i (sohbet odası).
 * Aynı sohbete bağlı tüm tab/açık ConversationView'lar listener olur.
 */

type Listener = (msg: SerializedMessage) => void;

declare global {
  // eslint-disable-next-line no-var
  var __etkinlikscoutMsgBus: Map<string, Set<Listener>> | undefined;
}

const BUS: Map<string, Set<Listener>> =
  globalThis.__etkinlikscoutMsgBus ?? (globalThis.__etkinlikscoutMsgBus = new Map());

export function subscribeMessages(conversationKey: string, listener: Listener): () => void {
  const key = conversationKey.toLowerCase();
  let set = BUS.get(key);
  if (!set) {
    set = new Set();
    BUS.set(key, set);
  }
  set.add(listener);
  return () => {
    const s = BUS.get(key);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) BUS.delete(key);
  };
}

export function publishMessage(conversationKey: string, msg: SerializedMessage): number {
  const key = conversationKey.toLowerCase();
  const set = BUS.get(key);
  if (!set) return 0;
  let delivered = 0;
  for (const listener of set) {
    try {
      listener(msg);
      delivered++;
    } catch {
      // ignore listener errors
    }
  }
  return delivered;
}

export function subscriberCount(conversationKey: string): number {
  return BUS.get(conversationKey.toLowerCase())?.size ?? 0;
}
