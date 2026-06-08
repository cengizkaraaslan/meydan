import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

/** Yakındaki kişiler — şimdilik sahte profiller. */
export interface Person {
  id: string;
  name: string;
  age: number;
  city: string;
  distanceKm: number;
  online: boolean;
  avatar: string;
  bio: string;
  interests: string[]; // kategori etiketleri
  gender: "male" | "female"; // dating eşleştirme için
  hasStory?: boolean; // aktif story → avatarda Instagram-tarzı halka
  tiktok?: string; // TikTok kullanıcı adı (@...) — mock, isimden türetilmiş
}

/** Şu an story'si olan (mock) kişiler — listelerde halka gösterilir. */
const STORY_IDS = new Set(["u1", "u3", "u5", "u7", "u9", "u12", "u13"]);

/** Türkçe ismi ASCII kullanıcı-adı parçasına çevirir. */
function handleSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ışğüöçİ]/g, (c) => ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", İ: "i" }[c] ?? c))
    .replace(/[^a-z0-9]/g, "");
}

const P = (id: string, name: string, age: number, city: string, distanceKm: number, online: boolean, sex: "men" | "women", n: number, bio: string, interests: string[]): Person => ({
  id, name, age, city, distanceKm, online,
  // Yüksek çözünürlüklü portreler (randomuser 128px çok bulanıktı → pravatar 600px).
  avatar: `https://i.pravatar.cc/600?img=${(n % 70) + 1}`,
  bio, interests,
  gender: sex === "men" ? "male" : "female",
  tiktok: `@${handleSlug(name)}_${city ? handleSlug(city).slice(0, 3) : "tr"}${n % 100}`,
});

export const PEOPLE: Person[] = [
  P("u1", "Deniz", 27, "İstanbul", 1.2, true, "women", 44, "Konser kaçırmam, indie sevdalısı 🎸", ["Konser", "Festival"]),
  P("u2", "Mert", 30, "İstanbul", 2.4, true, "men", 32, "Tiyatro ve stand-up bağımlısı.", ["Tiyatro", "Stand-up"]),
  P("u3", "Elif", 24, "İstanbul", 0.8, false, "women", 68, "Sergi gezmeyi ve kahveyi severim ☕", ["Sergi", "Atölye"]),
  P("u4", "Can", 29, "Ankara", 3.1, true, "men", 12, "Jazz, vinil, gece konserleri.", ["Konser"]),
  P("u5", "Zeynep", 26, "İzmir", 1.9, true, "women", 21, "Festival insanı, yazları sahilde 🎉", ["Festival", "Konser"]),
  P("u6", "Burak", 33, "İstanbul", 4.7, false, "men", 51, "Maç + spor etkinlikleri kaçmaz ⚽", ["Spor"]),
  P("u7", "Selin", 22, "İstanbul", 0.5, true, "women", 9, "Atölyeler ve yaratıcı buluşmalar.", ["Atölye", "Sergi"]),
  P("u8", "Kaan", 28, "Bursa", 5.3, false, "men", 77, "Rock konserleri ve doğa.", ["Konser", "Festival"]),
  P("u9", "İrem", 25, "İstanbul", 1.4, true, "women", 30, "Tiyatro öğretmeniyim, sahne aşkı 🎭", ["Tiyatro"]),
  P("u10", "Emre", 31, "Ankara", 2.0, true, "men", 65, "Stand-up gecelerinin müdavimi.", ["Stand-up", "Konser"]),
  P("u11", "Ada", 23, "İzmir", 3.8, false, "women", 90, "Çocuk etkinlikleri ve atölye gönüllüsü.", ["Çocuk", "Atölye"]),
  P("u12", "Tolga", 34, "İstanbul", 6.1, true, "men", 41, "Festival fotoğrafçısı 📷", ["Festival"]),
  P("u13", "Naz", 27, "İstanbul", 0.9, true, "women", 57, "Caz, şarap, sergi açılışları.", ["Konser", "Sergi"]),
  P("u14", "Oğuz", 26, "Antalya", 4.2, false, "men", 3, "Yazlık festivaller ve sahil partileri.", ["Festival", "Konser"]),
].map((p) => ({ ...p, hasStory: STORY_IDS.has(p.id) }));

export function getPerson(id: string): Person | undefined {
  return PEOPLE.find((p) => p.id === id);
}

// ── Mock sohbet ──
export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  ts: number;
}

const chatKey = (id: string) => `meydanfest:chat:${id}`;
const readKey = (id: string) => `meydanfest:chatread:${id}`;

/** Bu sohbeti "okundu" işaretle (şimdiki zamanı son-okuma damgası yapar). */
export async function markChatRead(personId: string) {
  try {
    await AsyncStorage.setItem(readKey(personId), String(Date.now()));
  } catch {
    // sessiz geç
  }
}

const OPENERS: Record<string, string> = {
  default: "Selam! Yaklaşan etkinliklerden hangisine gidiyorsun? 🎉",
};

const REPLIES = [
  "Süper, ben de oradayım! Orada buluşalım mı? 😄",
  "Aaa harika seçim, bilet aldın mı?",
  "Bu hafta sonu müsaitsen beraber gidebiliriz.",
  "Kesinlikle! Sahne önünde takılırız 🎸",
  "Ben de tam ona bakıyordum, ne tesadüf 🙌",
  "Olur! Birini daha çağırayım mı, kalabalık daha eğlenceli.",
];

function uid(seed: number) {
  return `m${seed}${Math.floor((seed * 9301 + 49297) % 233280)}`;
}

export function useChat(personId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await AsyncStorage.getItem(chatKey(personId));
      if (!alive) return;
      if (raw) {
        setMessages(JSON.parse(raw));
      } else {
        const seed: ChatMessage[] = [{ id: uid(1), fromMe: false, text: OPENERS.default, ts: Date.now() - 60000 }];
        setMessages(seed);
        AsyncStorage.setItem(chatKey(personId), JSON.stringify(seed));
      }
    })();
    return () => { alive = false; };
  }, [personId]);

  // Sohbet açıkken (bu ekran mount'luyken) mesaj değiştikçe okundu işaretle.
  // Ekrandan çıkıp da sonradan gelen mesaj (örn. geç gelen bot cevabı) okunmamış kalır.
  useEffect(() => {
    if (messages.length) void markChatRead(personId);
  }, [messages, personId]);

  const persist = useCallback((next: ChatMessage[]) => {
    setMessages(next);
    AsyncStorage.setItem(chatKey(personId), JSON.stringify(next));
  }, [personId]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    counter.current += 1;
    const mine: ChatMessage = { id: uid(counter.current + 100), fromMe: true, text: trimmed, ts: Date.now() };
    setMessages((prev) => {
      const next = [...prev, mine];
      AsyncStorage.setItem(chatKey(personId), JSON.stringify(next));
      return next;
    });
    // sahte cevap
    setTyping(true);
    const reply = REPLIES[(counter.current + trimmed.length) % REPLIES.length];
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => {
        const next = [...prev, { id: uid(counter.current + 500), fromMe: false, text: reply, ts: Date.now() }];
        AsyncStorage.setItem(chatKey(personId), JSON.stringify(next));
        return next;
      });
    }, 1400);
  }, [personId]);

  return { messages, typing, send, persist };
}
