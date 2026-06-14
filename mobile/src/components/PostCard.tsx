import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { router } from "expo-router";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapHaptic, impactHaptic } from "@/lib/haptics";
import { StoryAvatar } from "@/components/StoryAvatar";
import { MentionText } from "@/components/MentionText";
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
  // Post bir etkinliğe BAĞLI mı? Yalnız geçerli eventSlug varsa. Kendi başına (standalone)
  // oluşturulmuş postta eventSlug yok → etkinlik detayına BAĞLANMAZ, etkinlik etiketi/link gösterilmez.
  const hasEvent = !!post.eventSlug && String(post.eventSlug).trim().length > 0 && String(post.eventSlug).trim().toLowerCase() !== "null";

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

  // Gönderi sahibinin profiline git (sistem gönderisinde yok). Ad/avatarı param geçiyoruz
  // ki gerçek kullanıcıda (mock listede olmayan) profil yine isim+avatarla açılsın.
  const openAuthor = () => {
    if (!post.authorId || post.authorId === "system") return;
    tapHaptic();
    router.push({ pathname: "/kisi/[id]", params: { id: post.authorId, name: post.authorName ?? "", avatar: post.authorAvatar ?? "" } });
  };

  const openEvent = () => {
    if (isSystem && hasEvent) {
      tapHaptic();
      // Object-form: param expo-router tarafından düzgün encode edilir (slug Türkçe
      // karakter/boşluk içerse de URL bozulmaz). Ham `/etkinlik/${slug}` URL'yi bozuyordu.
      router.push({ pathname: "/etkinlik/[id]", params: { id: post.eventSlug! } });
    }
  };

  // ── Sistem / etkinlik duyurusu: sade, metin odaklı, küçük resim + 📣 rozet ──
  // Takip butonu YOK ama tepki + yorum normal gönderilerle aynı çalışır.
  if (isSystem) {
    return (
      <View style={[styles.sysCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
        <Pressable onPress={openEvent} disabled={!hasEvent} style={{ gap: 8 }}>
          <View style={styles.sysHead}>
            <Text style={styles.sysIcon}>📣</Text>
            <View style={[styles.sysBadge, { backgroundColor: T.surfaceStrong, borderColor: T.primary }]}>
              <Text style={[Type.micro, { color: T.primary }]}>SİSTEM</Text>
            </View>
            <Text style={[Type.label, { color: T.textFaint, marginLeft: "auto" }]}>{relTime(post.createdAt)}</Text>
          </View>

          {post.eventTitle && hasEvent ? (
            <Text style={[Type.label, { color: T.primary, marginLeft: 6 }]} numberOfLines={1}>🎟 {post.eventTitle}</Text>
          ) : null}

          <View style={styles.sysBody}>
            {post.imageUrl ? (
              <Image source={{ uri: post.imageUrl }} style={styles.sysThumb} contentFit="cover" transition={200} />
            ) : null}
            {post.text ? (
              <MentionText text={post.text} style={[Type.body, { color: T.text, flex: 1 }]} numberOfLines={6} />
            ) : null}
          </View>

          {hasEvent ? (
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
      {/* Üst: avatar + ad + zaman + takip / aksiyon. Avatar/ada dokun → kişinin profili. */}
      <View style={styles.head}>
        <Pressable onPress={openAuthor} style={styles.authorTap} hitSlop={4}>
          <StoryAvatar uri={post.authorAvatar} name={post.authorName ?? "✦"} size={38} />
          <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
            <Text style={[Type.title, { color: T.text }]} numberOfLines={1} ellipsizeMode="tail">
              {post.authorName?.trim() || "Meydanlı"}
            </Text>
            <Text style={[Type.label, { color: T.textFaint }]}>{relTime(post.createdAt)}</Text>
          </View>
        </Pressable>
        {!isMine ? (
          following ? (
            <Pressable
              onPress={() => { tapHaptic(); onToggleFollow(); }}
              style={[styles.followPill, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}
            >
              <Text style={[Type.label, { color: T.textDim }]} numberOfLines={1}>✓ Takip ediliyor</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => { tapHaptic(); onToggleFollow(); }}
              style={[styles.followPill, { borderColor: T.primary, backgroundColor: T.surfaceStrong }]}
            >
              <Text style={[Type.label, { color: T.primary }]} numberOfLines={1}>+ Takip et</Text>
            </Pressable>
          )
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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

      {/* Etkinlik etiketi — yalnız posta bağlı GERÇEK etkinlik varsa (standalone postta yok) */}
      {post.eventTitle && hasEvent ? (
        <View style={[styles.eventTag, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
          <Text style={[Type.label, { color: T.primary }]} numberOfLines={1}>🎟 {post.eventTitle}</Text>
        </View>
      ) : null}

      {/* Metin — soldan biraz içeride dursun (avatara yapışmasın). */}
      {post.text ? <MentionText text={post.text} style={[Type.body, { color: T.text, marginTop: 2, marginLeft: 8 }]} /> : null}

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
  card: { borderRadius: Radius.lg, borderWidth: 0, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 6, ...glow("#000", 10, 0.15) },
  // Tüm başlık satırı (avatar + ad + zaman + Sen/takip) 7px yukarı — hepsi birlikte hizalı kalsın.
  head: { flexDirection: "row", alignItems: "center", gap: 10, transform: [{ translateY: -7 }] },
  authorTap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  // "Sen" / "+ Takip et" / "✓ Takip ediliyor" pill'i: 6px yukarı (avatar+ad bloğuyla daha hizalı).
  // flexShrink:0 → uzun isimde pill sıkışmaz; bunun yerine isim kısalır (ellipsis).
  followPill: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0, transform: [{ translateY: -6 }] },
  moreBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  eventTag: { alignSelf: "flex-start", borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6, maxWidth: "100%" },
  media: { width: "100%", height: 220, borderRadius: Radius.md, marginTop: 2 },
  // flexWrap + rowGap: çok tepki/uzun sayıda "yorum" yan yana sığmazsa alta sarar (yatay taşma yok).
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 18, rowGap: 8, marginTop: 0, marginLeft: 8 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 7 },
  summary: { flexDirection: "row", marginLeft: 2 },
  summaryEmoji: { fontSize: 12 },
  pickerWrap: { position: "absolute", bottom: "100%", left: 0, marginBottom: 8, zIndex: 20 },
  // Sistem / etkinlik kartı — başlık (📣 SİSTEM · 9 sa) kartın üstüne daha yakın olsun
  // diye üst padding azaltıldı (14→10).
  sysCard: { borderRadius: Radius.lg, borderWidth: 0, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 6, ...glow("#000", 10, 0.15) },
  // SİSTEM ikon + yazı bloğu 7px yukarı (kullanıcı gönderisindeki head ile aynı hizalama).
  sysHead: { flexDirection: "row", alignItems: "center", gap: 8, transform: [{ translateY: -7 }] },
  sysIcon: { fontSize: 18 },
  sysBadge: { borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 10, paddingVertical: 5 },
  // alignItems center: kısa metinli kartta görsel (thumb) ile metin dikey ortalanır →
  // metnin altında boşluk hissi kalkar (içerik–aksiyon arası gereksiz boşluk düzeldi).
  sysBody: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 2 },
  sysThumb: { width: 64, height: 64, borderRadius: Radius.md },
});
