import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/lib/theme";
import { resolveMentionUser } from "@/lib/mentions";

/**
 * Metni gösterirken "@..." etiketlerini mavi çizer ve TIKLANABİLİR yapar:
 * üstüne dokununca o kişinin profiline (/kisi) gider (email → kullanıcı çözümlenir).
 * E-posta mention'ı dahil: "@ad@site.com" tek parça vurgulanır.
 */
const MENTION_RE = /@[\w.+-]+(?:@[\w.-]+\.[a-zA-Z]{2,})?/g;

/** Mention etiketine dokununca: email'i çöz → profile yönlendir. */
async function openMention(token: string): Promise<void> {
  const email = token.replace(/^@/, "").trim();
  // Yalnız e-posta mention'ları bir profile götürür (basit @kelime atlanır).
  if (!email.includes("@")) return;
  try {
    const u = await resolveMentionUser(email);
    if (u?.id) {
      router.push({ pathname: "/kisi/[id]", params: { id: u.id, name: u.name ?? "", avatar: u.avatar ?? "" } });
    }
  } catch {
    /* çözümlenemezse sessiz */
  }
}

export function MentionText({
  text,
  style,
  numberOfLines,
  color,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  color?: string;
}) {
  const { t: T } = useTheme();
  const blue = color ?? T.blue;

  if (!text || text.indexOf("@") === -1) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    nodes.push(
      <Text
        key={`m${i++}`}
        style={{ color: blue, fontWeight: "600" }}
        onPress={() => openMention(token)}
        suppressHighlighting
      >
        {token}
      </Text>,
    );
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {nodes}
    </Text>
  );
}
