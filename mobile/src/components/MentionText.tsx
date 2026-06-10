import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * Metni gösterirken "@..." etiketlerini mavi renkte çizer (Twitter/Instagram gibi).
 * E-posta mention'ı dahil: "@ad@site.com" tek parça olarak vurgulanır.
 */
const MENTION_RE = /@[\w.+-]+(?:@[\w.-]+\.[a-zA-Z]{2,})?/g;

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
    nodes.push(
      <Text key={`m${i++}`} style={{ color: blue, fontWeight: "600" }}>
        {m[0]}
      </Text>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {nodes}
    </Text>
  );
}
