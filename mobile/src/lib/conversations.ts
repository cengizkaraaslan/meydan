import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPerson, type ChatMessage, type Person } from "./people";

/** Anasayfadaki sohbet balonu için: daha önce konuşulan kişiler + okunmamış sayısı. */
export interface Conversation {
  person: Person;
  last?: ChatMessage;
  unread: number;
}

// people.ts'teki anahtarlarla aynı önekler.
const PREFIX = "meydanfest:chat:";
const READ_PREFIX = "meydanfest:chatread:";

/** AsyncStorage'daki tüm sohbetleri (en yeni en üstte) okunmamış sayısıyla döndürür. */
export async function listConversations(): Promise<Conversation[]> {
  const keys = await AsyncStorage.getAllKeys();
  const chatKeys = keys.filter((k) => k.startsWith(PREFIX));
  if (chatKeys.length === 0) return [];

  const readKeys = chatKeys.map((k) => READ_PREFIX + k.slice(PREFIX.length));
  const entries = await AsyncStorage.multiGet([...chatKeys, ...readKeys]);
  const map = new Map(entries);

  const out: Conversation[] = [];
  for (const key of chatKeys) {
    const raw = map.get(key);
    if (!raw) continue;
    const id = key.slice(PREFIX.length);
    const person = getPerson(id);
    if (!person) continue;
    let msgs: ChatMessage[] = [];
    try {
      msgs = JSON.parse(raw) as ChatMessage[];
    } catch {
      continue;
    }
    if (!msgs.length) continue;

    const lastRead = Number(map.get(READ_PREFIX + id) ?? "0") || 0;
    // Karşı taraftan (fromMe=false) gelen ve son-okumadan sonraki mesajlar okunmamış.
    const unread = msgs.filter((m) => !m.fromMe && m.ts > lastRead).length;

    out.push({ person, last: msgs[msgs.length - 1], unread });
  }

  out.sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0));
  return out;
}

/** Tüm sohbetlerdeki toplam okunmamış mesaj sayısı (balon rozeti için). */
export function totalUnread(convos: Conversation[]): number {
  return convos.reduce((sum, c) => sum + c.unread, 0);
}
