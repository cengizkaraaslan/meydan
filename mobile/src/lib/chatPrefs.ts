import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * Sohbet gizlilik tercihleri — tüm sohbetlere uygulanır, cihazda saklanır (AsyncStorage).
 * chat.ts polling'i `getChatPrefs()` ile senkron okur; UI `useChatPrefs()` ile reaktif dinler.
 */
export interface ChatPrefs {
  hideLastSeen: boolean; // son görülme + çevrimiçi durumunu karşı taraftan gizle
  hideTyping: boolean; // "yazıyor…" göstergesini gönderme
  hideReadReceipts: boolean; // mesaj okuyunca karşı tarafa okundu (mavi tik) gönderme
}

const KEYS: Record<keyof ChatPrefs, string> = {
  hideLastSeen: "meydanfest:chat:hideLastSeen",
  hideTyping: "meydanfest:chat:hideTyping",
  hideReadReceipts: "meydanfest:chat:hideReadReceipts",
};

let _prefs: ChatPrefs = { hideLastSeen: false, hideTyping: false, hideReadReceipts: false };
let _loaded = false;
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

/** Anlık değer (polling/senkron erişim için). */
export function getChatPrefs(): ChatPrefs {
  return _prefs;
}

async function load(): Promise<void> {
  try {
    const pairs = await AsyncStorage.multiGet([KEYS.hideLastSeen, KEYS.hideTyping, KEYS.hideReadReceipts]);
    const map = Object.fromEntries(pairs);
    _prefs = {
      hideLastSeen: map[KEYS.hideLastSeen] === "1",
      hideTyping: map[KEYS.hideTyping] === "1",
      hideReadReceipts: map[KEYS.hideReadReceipts] === "1",
    };
  } catch {
    /* yoksay */
  }
  _loaded = true;
  notify();
}
void load();

export async function setChatPref(key: keyof ChatPrefs, value: boolean): Promise<void> {
  _prefs = { ..._prefs, [key]: value };
  notify();
  try {
    await AsyncStorage.setItem(KEYS[key], value ? "1" : "0");
  } catch {
    /* yoksay */
  }
}

/** Reaktif hook (ayar ekranı). */
export function useChatPrefs(): ChatPrefs {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (!_loaded) void load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return _prefs;
}
