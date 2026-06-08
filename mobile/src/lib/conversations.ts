import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPerson, type ChatMessage, type Person } from "./people";

/** Anasayfadaki sohbet balonu için: daha önce konuşulan kişiler. */
export interface Conversation {
  person: Person;
  last?: ChatMessage;
}

// people.ts'teki chatKey ile aynı önek.
const PREFIX = "meydanfest:chat:";

/** AsyncStorage'daki tüm sohbetleri (en yeni en üstte) döndürür. */
export async function listConversations(): Promise<Conversation[]> {
  const keys = await AsyncStorage.getAllKeys();
  const chatKeys = keys.filter((k) => k.startsWith(PREFIX));
  if (chatKeys.length === 0) return [];

  const entries = await AsyncStorage.multiGet(chatKeys);
  const out: Conversation[] = [];
  for (const [key, raw] of entries) {
    if (!raw) continue;
    const person = getPerson(key.slice(PREFIX.length));
    if (!person) continue;
    let msgs: ChatMessage[] = [];
    try {
      msgs = JSON.parse(raw) as ChatMessage[];
    } catch {
      continue;
    }
    if (!msgs.length) continue;
    out.push({ person, last: msgs[msgs.length - 1] });
  }

  out.sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0));
  return out;
}
