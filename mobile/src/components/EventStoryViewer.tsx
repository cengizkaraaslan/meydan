import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  // ⋯ menüsü açık mı (açıkken otomatik ilerleme durur).
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = useSharedValue(0);

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
    if (!segment || menuOpen) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: SEGMENT_MS }, (finished) => {
      if (finished) runOnJS(advance)();
    });
    return () => { cancelAnimation(progress); };
  }, [gi, si, segment, advance, progress, menuOpen]);

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

  if (!group || !segment) return null;

  const isRealPerson = !group.isMe && !!getPerson(group.id);

  // Etkinlikten paylaşılan story → "📍 konum · etkinlik" etiketi (alanlar opsiyonel).
  const eventLabel = [segment.city, segment.eventTitle].filter(Boolean).join(" · ");

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        <Image source={{ uri: segment.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent", "transparent", "rgba(0,0,0,0.55)"]}
          locations={[0, 0.25, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Dokunma alanları: sol yarı = geri, sağ yarı = ileri */}
        <View style={styles.tapRow} pointerEvents="box-none">
          <Pressable style={styles.tapHalf} onPress={prev} />
          <Pressable style={styles.tapHalf} onPress={next} />
        </View>

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
      </View>
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
  tapRow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
  tapHalf: { flex: 1 },
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
});
