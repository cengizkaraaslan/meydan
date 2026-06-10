import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { router } from "expo-router";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapHaptic, impactHaptic } from "@/lib/haptics";
import { StoryAvatar } from "@/components/StoryAvatar";
import { ReactionPicker } from "@/components/ReactionPicker";
import { type FeedPost } from "@/lib/social";

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
  /** Benim gönderim ve 10 dk içinde → düzenle/sil aksiyon menüsü göster. */
  canEdit?: boolean;
  onReact: (emoji: string) => void;
  onOpenComments: () => void;
  onToggleFollow: () => void;
  /** "⋯" / uzun bas → aksiyon menüsünü aç (yalnız canEdit ise tetiklenir). */
  onOpenActions?: () => void;
}

/** Instagram-tarzı sosyal gönderi kartı: yazar + içerik + tepki + yorum. */
export function PostCard({ post, isMine, following, canEdit, onReact, onOpenComments, onToggleFollow, onOpenActions }: Props) {
  const { t: T } = useTheme();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);

  const isSystem = post.authorId === "system";

  // Tepki göstergesi + yorum satırı (hem normal hem sistem kartında ortak kullanılır).
  const renderFooter = () => (
    <View style={[styles.footer, picker ? { zIndex: 10 } : undefined]}>
      <View style={{ position: "relative" }}>
        {picker ? (
          <View style={styles.pickerWrap} pointerEvents="box-none">
            <ReactionPicker myReaction={post.myReaction} onPick={doReact} />
          </View>
        ) : null}

        <Pressable
          disabled={busy}
          hitSlop={8}
          onPress={() => { tapHaptic(); setPicker((v) => !v); }}
          onLongPress={() => { impactHaptic(); setPicker(true); }}
          style={[
            styles.likeBtn,
            {
              backgroundColor: post.myReaction ? T.surfaceStrong : "transparent",
              borderColor: post.myReaction ? T.primary : T.hairline,
            },
          ]}
        >
          {post.myReaction ? (
            <>
              <Animated.Text key={post.myReaction} entering={FadeIn} style={{ fontSize: 16 }}>
                {post.myReaction}
              </Animated.Text>
              <Text style={[Type.label, { color: T.primary }]}>Sen</Text>
            </>
          ) : (
            <Text style={[Type.label, { color: T.textDim }]}>👍 Beğen</Text>
          )}

          {topEmojis.length > 0 ? (
            <View style={styles.summary}>
              {topEmojis.map((e) => (
                <Text key={e} style={styles.summaryEmoji}>{e}</Text>
              ))}
            </View>
          ) : null}
          {post.reactionTotal > 0 ? (
            <Text style={[Type.label, { color: T.textFaint }]}>{post.reactionTotal}</Text>
          ) : null}
        </Pressable>
      </View>

      <Pressable onPress={() => { tapHaptic(); onOpenComments(); }} hitSlop={8}>
        <Text style={[Type.label, { color: T.textDim }]}>💬 {post.commentCount} yorum</Text>
      </Pressable>
    </View>
  );

  // En çok kullanılan 1-3 emoji özeti (büyükten küçüğe).
  const topEmojis = useMemo(() => {
    const entries = Object.entries(post.reactions ?? {}).filter(([, n]) => n > 0);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 3).map(([e]) => e);
  }, [post.reactions]);

  const doReact = async (emoji: string) => {
    setPicker(false);
    setBusy(true);
    try { await onReact(emoji); } finally { setBusy(false); }
  };

  const openEvent = () => {
    if (isSystem && post.eventSlug) {
      tapHaptic();
      // Object-form: param expo-router tarafından düzgün encode edilir (slug Türkçe
      // karakter/boşluk içerse de URL bozulmaz). Ham `/etkinlik/${slug}` URL'yi bozuyordu.
      router.push({ pathname: "/etkinlik/[id]", params: { id: post.eventSlug } });
    }
  };

  // ── Sistem / etkinlik duyurusu: sade, metin odaklı, küçük resim + 📣 rozet ──
  // Takip butonu YOK ama tepki + yorum normal gönderilerle aynı çalışır.
  if (isSystem) {
    return (
      <View style={[styles.sysCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
        <Pressable onPress={openEvent} disabled={!post.eventSlug} style={{ gap: 8 }}>
          <View style={styles.sysHead}>
            <Text style={styles.sysIcon}>📣</Text>
            <View style={[styles.sysBadge, { backgroundColor: T.surfaceStrong, borderColor: T.primary }]}>
              <Text style={[Type.micro, { color: T.primary }]}>SİSTEM</Text>
            </View>
            <Text style={[Type.label, { color: T.textFaint, marginLeft: "auto" }]}>{relTime(post.createdAt)}</Text>
          </View>

          {post.eventTitle ? (
            <Text style={[Type.label, { color: T.primary }]} numberOfLines={1}>🎟 {post.eventTitle}</Text>
          ) : null}

          <View style={styles.sysBody}>
            {post.imageUrl ? (
              <Image source={{ uri: post.imageUrl }} style={styles.sysThumb} contentFit="cover" transition={200} />
            ) : null}
            {post.text ? (
              <Text style={[Type.body, { color: T.text, flex: 1 }]} numberOfLines={6}>{post.text}</Text>
            ) : null}
          </View>

          {post.eventSlug ? (
            <Text style={[Type.label, { color: T.primary }]}>Etkinliğe git →</Text>
          ) : null}
        </Pressable>

        {/* Popup açıkken dışına dokununca kapatan görünmez katman */}
        {picker ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicker(false)} />
        ) : null}

        {/* Tepki + yorum satırı (normal gönderilerle aynı) */}
        {renderFooter()}
      </View>
    );
  }

  return (
    <Pressable
      onLongPress={canEdit ? () => { impactHaptic(); onOpenActions?.(); } : undefined}
      delayLongPress={300}
      style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }]}
    >
      {/* Üst: avatar + ad + zaman + takip / aksiyon */}
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
              onPress={() => { tapHaptic(); onToggleFollow(); }}
              style={[styles.followPill, { borderColor: T.primary, backgroundColor: T.surfaceStrong }]}
            >
              <Text style={[Type.label, { color: T.primary }]}>+ Takip et</Text>
            </Pressable>
          )
        ) : (
          // "Sen" + "⋯" satırın üstüne hizalı (dikey ortada değil, biraz yukarıda).
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: -2 }}>
            <View style={[styles.followPill, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
              <Text style={[Type.label, { color: T.textFaint }]}>Sen</Text>
            </View>
            {canEdit ? (
              <Pressable
                onPress={() => { tapHaptic(); onOpenActions?.(); }}
                hitSlop={10}
                style={[styles.moreBtn, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}
              >
                <Text style={{ color: T.textDim, fontSize: 18, lineHeight: 18, fontWeight: "800" }}>⋯</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {/* Etkinlik etiketi */}
      {post.eventTitle ? (
        <View style={[styles.eventTag, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
          <Text style={[Type.label, { color: T.primary }]} numberOfLines={1}>🎟 {post.eventTitle}</Text>
        </View>
      ) : null}

      {/* Metin — soldan biraz içeride dursun (avatara yapışmasın). */}
      {post.text ? <Text style={[Type.body, { color: T.text, marginTop: 2, marginLeft: 8 }]}>{post.text}</Text> : null}

      {/* Görsel */}
      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.media} contentFit="cover" transition={200} />
      ) : null}

      {/* Popup açıkken dışına dokununca kapatan görünmez katman (footer'ın altında kalır) */}
      {picker ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicker(false)} />
      ) : null}

      {/* Aksiyon satırı: tek "beğen" göstergesi + yorum */}
      {renderFooter()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8, ...glow("#000", 10, 0.15) },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  followPill: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6 },
  moreBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  eventTag: { alignSelf: "flex-start", borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6, maxWidth: "100%" },
  media: { width: "100%", height: 220, borderRadius: Radius.md, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 4, marginLeft: 8 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 7 },
  summary: { flexDirection: "row", marginLeft: 2 },
  summaryEmoji: { fontSize: 12 },
  pickerWrap: { position: "absolute", bottom: "100%", left: 0, marginBottom: 8, zIndex: 20 },
  // Sistem / etkinlik kartı
  sysCard: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6, ...glow("#000", 10, 0.15) },
  sysHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sysIcon: { fontSize: 18 },
  sysBadge: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 8, paddingVertical: 3 },
  sysBody: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 2 },
  sysThumb: { width: 72, height: 72, borderRadius: Radius.md },
});
