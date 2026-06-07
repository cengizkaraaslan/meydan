import "server-only";
import type { EventChatMessage } from "./event-chat-store";

/**
 * Etkinlik group chat pub/sub. globalThis singleton.
 *
 * Anahtar = etkinlik slug. Aynı odaya bağlı tüm SSE tüketicileri listener olur.
 * messaging-bus ile aynı pattern, ayrı bus — DM/group karışmasın.
 */

type Listener = (msg: EventChatMessage) => void;

declare global {
  // eslint-disable-next-line no-var
  var __etkinlikscoutEventChatBus:
    | Map<string, Set<Listener>>
    | undefined;
}

const BUS: Map<string, Set<Listener>> =
  globalThis.__etkinlikscoutEventChatBus ??
  (globalThis.__etkinlikscoutEventChatBus = new Map());

export function subscribeEventChat(
  slug: string,
  listener: Listener,
): () => void {
  const key = slug.toLowerCase();
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

export function publishEventChat(
  slug: string,
  msg: EventChatMessage,
): number {
  const key = slug.toLowerCase();
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
