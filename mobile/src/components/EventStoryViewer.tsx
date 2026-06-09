import React, { useCallback, useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { sendStoryReply } from "@/lib/chat";
import { tapH } from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Radius, Type } from "@/theme/aurora";
import { StoryAvatar } from "@/components/StoryAvatar";
import { getPerson } from "@/lib/people";
import { useTheme } from "@/lib/theme";

const SEGMENT_MS = 4000;

export interface StorySegment {
  uri: string;
  caption?: string;
  /** Story bir etkinlikten paylaşıldıysa etkinlik adı (opsiyonel, geri uyumlu). */
  eventTitle?: string;
  /** Etkinliğin şehri/konumu (opsiyonel, geri uyumlu). */
  city?: string;
}

export interface StoryGroup {
  id: string;
  name: string;
  avatar: string;
  isMe?: boolean;
  segments: StorySegment[];
}

interface Props {
  groups: StoryGroup[];
  startIndex?: number;
  onClose: () => void;
  /** Sadece isMe grubunda görünür "Sil" akışı. Verilmezse ⋯ butonu gizlenir (geri uyumluluk). */
  onDeleteSegment?: (groupIndex: number, segmentIndex: number) => void;
}

/**
 * Instagram-tarzı çoklu-segment story izleyici. Üstte segment başına ilerleme
 * çubuğu; aktif segment ~4sn'de dolar → otomatik sonraki segment, sonra sonraki
 * grup, son grup bitince kapanır. Sağ yarı dokun = ileri, sol yarı = geri.
 */
export function EventStoryViewer({ groups, startIndex = 0, onClose, onDeleteSegment }: Props) {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { width: SW } = useWindowDimensions();
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  // ⋯ menüsü açık mı (açıkken otomatik ilerleme durur).
  const [menuOpen, setMenuOpen] = useState(false);
  // Pinch ile yakınlaştırma sürerken otomatik ilerlemeyi durdur.
  const [zooming, setZooming] = useState(false);
  // Story'e yanıt (gerçek kişide DM): yazarken otomatik ilerleme durur.
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const progress = useSharedValue(0);

  // İsteğe bağlı pinch-to-zoom: parmakla yakınlaştır, bırakınca normale döner.
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const group = groups[gi];
  const segment = group?.segments[si];

  // ⋯ butonu yalnızca isMe grubunda + onDeleteSegment verilmişse görünür.
  const canDelete = !!group?.isMe && !!onDeleteSegment;

  // gi değişince ilk segmente dön
  useEffect(() => {
    setSi(0);
  }, [gi]);

  const close = useCallback(() => {
    cancelAnimation(progress);
    onClose();
  }, [onClose, progress]);

  // Segment ilerleyişi → bitince sonraki segment/grup/kapan.
  const advance = useCallback(() => {
    const g = groups[gi];
    if (!g) { close(); return; }
    if (si + 1 < g.segments.length) {
      setSi((s) => s + 1);
    } else if (gi + 1 < groups.length) {
      setGi((x) => x + 1);
    } else {
      close();
    }
  }, [groups, gi, si, close]);

  // Aktif segment için zamanlayıcıyı başlat (reanimated withTiming + runOnJS).
  // Menü açıkken durdur; menü kapanınca segment baştan ilerler.
  useEffect(() => {
    if (!segment || menuOpen || zooming || replying) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: SEGMENT_MS }, (finished) => {
      if (finished) runOnJS(advance)();
    });
    return () => { cancelAnimation(progress); };
  }, [gi, si, segment, advance, progress, menuOpen, zooming, replying]);

  // Segment değişince zoom'u sıfırla (yeni görsel yakınlaştırılmış başlamasın).
  useEffect(() => {
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
  }, [gi, si, scale, tx, ty]);

  const prev = useCallback(() => {
    if (si > 0) {
      setSi((s) => s - 1);
    } else if (gi > 0) {
      setGi((x) => x - 1);
    } else {
      progress.value = 0;
      progress.value = withTiming(1, { duration: SEGMENT_MS }, (finished) => {
        if (finished) runOnJS(advance)();
      });
    }
  }, [si, gi, advance, progress]);

  const next = useCallback(() => {
    advance();
  }, [advance]);

  const openProfile = useCallback(() => {
    const g = groups[gi];
    if (!g || g.isMe) return;
    if (getPerson(g.id)) {
      onClose();
      router.push(`/kisi/${g.id}`);
    }
  }, [groups, gi, onClose]);

  const onPressDelete = useCallback(() => {
    setMenuOpen(false);
    cancelAnimation(progress);
    onDeleteSegment?.(gi, si);
  }, [onDeleteSegment, gi, si, progress]);

  // Story'e yanıt → karşı tarafın DM'ine gönder (Instagram tarzı), "Gönderildi ✓" göster.
  const onSendReply = useCallback(async () => {
    const g = groups[gi];
    const txt = reply.trim();
    if (!g || !txt) return;
    tapH();
    setReply("");
    Keyboard.dismiss();
    const ok = await sendStoryReply(g.id, txt);
    if (ok) {
      setSentFlash(true);
      setTimeout(() => setSentFlash(false), 1600);
    }
  }, [groups, gi, reply]);

  // Dokunma: sol yarı = geri, sağ yarı = ileri. Yakınlaştırılmışken gezinme yok.
  const tapNav = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e, success) => {
      if (!success || scale.value > 1.01) return;
      if (e.x < SW / 2) runOnJS(prev)();
      else runOnJS(next)();
    });

  // Pinch: 1–4 arası yakınlaştır; bırakınca normale (1) döner.
  const pinch = Gesture.Pinch()
    .onStart(() => runOnJS(setZooming)(true))
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(e.scale, 1), 4);
    })
    .onEnd(() => {
      scale.value = withTiming(1);
      tx.value = withTiming(0);
      ty.value = withTiming(0);
      runOnJS(setZooming)(false);
    });

  // Yakınlaştırılmışken iki parmakla sürükleyerek gez.
  const pan = Gesture.Pan().onUpdate((e) => {
    if (scale.value <= 1.01) return;
    tx.value = e.translationX;
    ty.value = e.translationY;
  });

  const gesture = Gesture.Race(tapNav, Gesture.Simultaneous(pinch, pan));

  if (!group || !segment) return null;

  const isRealPerson = !group.isMe && !!getPerson(group.id);

  // Etkinlikten paylaşılan story → "📍 konum · etkinlik" etiketi (alanlar opsiyonel).
  const eventLabel = [segment.city, segment.eventTitle].filter(Boolean).join(" · ");

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.root}>
        {/* Görsel + dokunma/pinch jestleri. contentFit="contain": fotoğraf KIRPILMADAN
            sığar (eski "cover" hafif zoom/kırpma hissi veriyordu). */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, imgStyle]}>
              <Image source={{ uri: segment.uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent", "transparent", "rgba(0,0,0,0.55)"]}
          locations={[0, 0.25, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* İlerleme çubukları (segment başına) */}
        <View style={[styles.bars, { top: insets.top + 8 }]} pointerEvents="none">
          {group.segments.map((_, i) => (
            <SegmentBar key={i} state={i < si ? "done" : i === si ? "active" : "pending"} progress={progress} />
          ))}
        </View>

        {/* Üst: avatar + isim (gerçek kişide profil açar) */}
        <Pressable
          onPress={isRealPerson ? openProfile : undefined}
          style={[styles.header, { top: insets.top + 22 }]}
          hitSlop={8}
        >
          <StoryAvatar uri={group.avatar} name={group.name} size={36} />
          <Text style={[Type.title, { color: "#fff" }]} numberOfLines={1}>
            {group.isMe ? `${group.name} · Sen` : group.name}
          </Text>
        </Pressable>

        {/* ⋯ menü (sadece kendi story'mde, onDeleteSegment varsa) */}
        {canDelete ? (
          <Pressable
            onPress={() => { cancelAnimation(progress); setMenuOpen(true); }}
            hitSlop={12}
            style={[styles.more, { top: insets.top + 22 }]}
          >
            <Text style={styles.moreTxt}>⋯</Text>
          </Pressable>
        ) : null}

        {/* Kapat */}
        <Pressable onPress={close} hitSlop={12} style={[styles.close, { top: insets.top + 22 }]}>
          <Text style={styles.closeTxt}>✕</Text>
        </Pressable>

        {/* Etkinlik etiketi (📍 konum · etkinlik) — caption'ın üstünde, ayrı blok */}
        {eventLabel ? (
          <View
            style={[
              styles.eventTagWrap,
              { bottom: insets.bottom + (segment.caption ? 84 : 36) },
            ]}
            pointerEvents="none"
          >
            <Text style={[Type.body, styles.eventTag]} numberOfLines={1}>
              📍 {eventLabel}
            </Text>
          </View>
        ) : null}

        {/* Caption */}
        {segment.caption ? (
          <View style={[styles.captionWrap, { bottom: insets.bottom + 36 }]} pointerEvents="none">
            <Text style={[Type.body, styles.caption]}>{segment.caption}</Text>
          </View>
        ) : null}

        {/* ⋯ menü sheet'i: Sil / İptal */}
        {menuOpen ? (
          <View style={styles.menuScrim}>
            {/* Dışına dokun → kapat (timer menü kapanınca devam eder) */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
            <View
              style={[
                styles.menuCard,
                { backgroundColor: T.bgElevated, borderColor: T.hairline, bottom: insets.bottom + 24 },
              ]}
            >
              <Pressable onPress={onPressDelete} style={styles.menuItem} hitSlop={6}>
                <Text style={[Type.title, { color: "#FF5A5F" }]}>🗑️  Sil</Text>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: T.hairline }]} />
              <Pressable onPress={() => setMenuOpen(false)} style={styles.menuItem} hitSlop={6}>
                <Text style={[Type.title, { color: T.text }]}>İptal</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Gerçek kişi story'sine yanıt → DM (Instagram tarzı) */}
        {isRealPerson ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.replyWrap}
          >
            {sentFlash ? (
              <View style={styles.sentFlash}>
                <Text style={styles.sentFlashTxt}>Gönderildi ✓</Text>
              </View>
            ) : null}
            <View style={[styles.replyBar, { paddingBottom: insets.bottom + 10 }]}>
              <TextInput
                value={reply}
                onChangeText={setReply}
                onFocus={() => setReplying(true)}
                onBlur={() => setReplying(false)}
                placeholder={`${group.name} kişisine yanıt ver…`}
                placeholderTextColor="rgba(255,255,255,0.65)"
                style={styles.replyInput}
                returnKeyType="send"
                onSubmitEditing={onSendReply}
                blurOnSubmit
              />
              <Pressable onPress={onSendReply} hitSlop={8} style={styles.replySend}>
                <Ionicons name="send" size={19} color="#fff" />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function SegmentBar({ state, progress }: { state: "done" | "active" | "pending"; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    width: state === "done" ? "100%" : state === "active" ? `${progress.value * 100}%` : "0%",
  }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bars: { position: "absolute", left: 10, right: 10, flexDirection: "row", gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  barFill: { height: 3, borderRadius: 2, backgroundColor: "#fff" },
  header: { position: "absolute", left: 14, right: 56, flexDirection: "row", alignItems: "center", gap: 10 },
  close: { position: "absolute", right: 16, width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  closeTxt: { color: "#fff", fontSize: 22, fontWeight: "700" },
  more: { position: "absolute", right: 54, width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  moreTxt: { color: "#fff", fontSize: 26, fontWeight: "800", lineHeight: 26, marginTop: -6 },
  menuScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  menuCard: { position: "absolute", left: 16, right: 16, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: "hidden" },
  menuItem: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  menuDivider: { height: StyleSheet.hairlineWidth },
  eventTagWrap: { position: "absolute", left: 18, right: 18, alignItems: "center" },
  eventTag: {
    color: "#fff", fontWeight: "700", textAlign: "center", backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.md, overflow: "hidden",
    maxWidth: "100%",
  },
  captionWrap: { position: "absolute", left: 18, right: 18, alignItems: "center" },
  caption: {
    color: "#fff", textAlign: "center", backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md, overflow: "hidden",
  },
  replyWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  replyInput: {
    flex: 1, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.55)", paddingHorizontal: 18, color: "#fff", fontSize: 15,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  replySend: {
    width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  sentFlash: {
    alignSelf: "center", backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 10,
  },
  sentFlashTxt: { color: "#fff", fontWeight: "700" },
});
