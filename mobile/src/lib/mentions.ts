import { useCallback, useRef, useState } from "react";
import { API_BASE } from "./api";

/** @mention için aday kullanıcı (email = bildirilecek kişi). */
export interface MentionUser {
  email: string;
  name: string | null;
  avatar: string | null;
  /** Profile gitmek için kimlik (mobil deviceId / web User.id); yoksa null. */
  id: string | null;
}

/** Bir email'e karşılık gelen kullanıcıyı bul (mention'a tıklayınca profile gitmek için). */
export async function resolveMentionUser(email: string): Promise<MentionUser | null> {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const list = await searchMentionUsers(e);
  return list.find((u) => u.email.toLowerCase() === e) ?? list[0] ?? null;
}

/** Mention autocomplete için kullanıcı ara (ad/email). Boş q ilk birkaç kullanıcıyı döner. */
export async function searchMentionUsers(q: string): Promise<MentionUser[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/mobile/mentionable-users?q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: MentionUser[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

// Metnin SONUNDAKİ "@token" (önünde boşluk veya başlangıç, içinde boşluk yok).
const TRAILING_MENTION = /(^|\s)@(\S*)$/;

/**
 * Bir TextInput'a @mention autocomplete davranışı ekler. Kullanıcı metin sonunda
 * "@ad" yazdıkça eşleşen kullanıcıları getirir; pick() seçileni "@email " olarak yazar.
 * Basit (sona-çapalı) yaklaşım: ortada düzenlemede tetiklenmez — yorum/mesaj için yeterli.
 */
export function useMentionField(value: string, setValue: (s: string) => void) {
  const [results, setResults] = useState<MentionUser[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setResults([]);
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setValue(text);
      const m = text.match(TRAILING_MENTION);
      if (!m) {
        clear();
        return;
      }
      const query = m[2];
      if (timer.current) clearTimeout(timer.current);
      const myReq = ++reqId.current;
      timer.current = setTimeout(async () => {
        const list = await searchMentionUsers(query);
        // Sadece en son istek sonucu uygulansın (yarış önleme).
        if (myReq === reqId.current) setResults(list);
      }, 180);
    },
    [setValue, clear],
  );

  const pick = useCallback(
    (email: string) => {
      const next = value.replace(TRAILING_MENTION, (_full, pre: string) => `${pre}@${email} `);
      setValue(next);
      clear();
    },
    [value, setValue, clear],
  );

  return { results, onChangeText, pick, clear };
}
