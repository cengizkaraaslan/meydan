import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH, impactH } from "@/lib/haptics";
import { StoryAvatar } from "@/components/StoryAvatar";
import { REACTIONS, type FeedPost } from "@/lib/social";

/** "şimdi / 5 dk / 3 sa / 2 g" biçiminde göreli zaman. */
function relTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} g`;
  const w = Math.floor(d / 7);
  return `${w} hf`;
}

interface Props {
  post: FeedPost;
  /** Bu gönderiyi ben mi attım (takip butonu gizlensin). */
  isMine: boolean;
  /** Yazarı takip ediyor muyum (takip butonu durumu). */
  following: boolean;
  onReact: (emoji: string) => void;
  onOpenComments: () => void;
  onToggleFollow: () => void;
}

/** Instagram-tarzı sosyal gönderi kartı: yazar + içerik + tepki + yorum. */
export function PostCard({ post, isMine, following, onReact, onOpenComments, onToggleFollow }: Props) {
  const { t: T } = useTheme();
  const [busy, setBusy] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }]}>
      {/* Üst: avatar + ad + zaman + takip */}
      <View style={styles.head}>
        <StoryAvatar uri={post.authorAvatar} name={post.authorName ?? "✦"} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={[Type.title, { color: T.text }]} numberOfLines={1}>
            {post.authorName?.trim() || "Meydanlı"}
          </Text>
          <Text style={[Type.label, { color: T.textFaint }]}>{relTime(post.createdAt)}</Text>
        </View>
        {!isMine ? (
          following ? (
            <View style={[styles.followPill, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
              <Text style={[Type.label, { color: T.textDim }]}>Takip ediliyor</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => { tapH(); onToggleFollow(); }}
              style={[styles.followPill, { borderColor: T.primary, backgroundColor: T.surfaceStrong }]}
            >
              <Text style={[Type.label, { color: T.primary }]}>+ Takip et</Text>
            </Pressable>
          )
        ) : (
          <View style={[styles.followPill, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
            <Text style={[Type.label, { color: T.textFaint }]}>Sen</Text>
          </View>
        )}
      </View>

      {/* Etkinlik etiketi */}
      {post.eventTitle ? (
        <View style={[styles.eventTag, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
          <Text style={[Type.label, { color: T.primary }]} numberOfLines={1}>🎟 {post.eventTitle}</Text>
        </View>
      ) : null}

      {/* Metin */}
      {post.text ? <Text style={[Type.body, { color: T.text, marginTop: 2 }]}>{post.text}</Text> : null}

      {/* Görsel */}
      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.media} contentFit="cover" transition={200} />
      ) : null}

      {/* Tepki satırı */}
      <View style={styles.reactRow}>
        {REACTIONS.map((emoji) => {
          const count = post.reactions?.[emoji] ?? 0;
          const mine = post.myReaction === emoji;
          return (
            <Pressable
              key={emoji}
              disabled={busy}
              onPress={async () => {
                impactH();
                setBusy(true);
                try { await onReact(emoji); } finally { setBusy(false); }
              }}
              style={[
                styles.reactChip,
                {
                  backgroundColor: mine ? T.surfaceStrong : "transparent",
                  borderColor: mine ? T.primary : T.hairline,
                },
              ]}
            >
              <Text style={{ fontSize: 15 }}>{emoji}</Text>
              {count > 0 ? (
                <Text style={[Type.label, { color: mine ? T.primary : T.textFaint }]}>{count}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Yorum + toplam tepki */}
      <View style={styles.footer}>
        <Pressable onPress={() => { tapH(); onOpenComments(); }} hitSlop={8}>
          <Text style={[Type.label, { color: T.textDim }]}>💬 {post.commentCount} yorum</Text>
        </Pressable>
        {post.reactionTotal > 0 ? (
          <Text style={[Type.label, { color: T.textFaint }]}>{post.reactionTotal} tepki</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, gap: 10, ...glow("#000", 10, 0.15) },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  followPill: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6 },
  eventTag: { alignSelf: "flex-start", borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6, maxWidth: "100%" },
  media: { width: "100%", height: 220, borderRadius: Radius.md, marginTop: 2 },
  reactRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  reactChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 10, paddingVertical: 6 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
});
