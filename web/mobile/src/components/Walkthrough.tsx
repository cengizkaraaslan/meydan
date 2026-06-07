import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH, impactH } from "@/lib/haptics";
import { Radius, Space, Type, glow } from "@/theme/aurora";

interface Slide {
  emoji: string;
  titleKey: string;
  bodyKey: string;
}

const SLIDES: readonly Slide[] = [
  { emoji: "🎉", titleKey: "wt1_title", bodyKey: "wt1_body" },
  { emoji: "💜", titleKey: "wt2_title", bodyKey: "wt2_body" },
  { emoji: "➕", titleKey: "wt3_title", bodyKey: "wt3_body" },
  { emoji: "🎨", titleKey: "wt4_title", bodyKey: "wt4_body" },
];

/**
 * İlk açılışta gösterilen tam ekran "next next" tanıtım turu.
 * Kök _layout'tan `!seenIntro` iken render edilir; bitince/atlayınca onDone().
 */
export function Walkthrough({ onDone }: { onDone: () => void }) {
  const { t: T } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const circle = Math.min(width * 0.46, 220);

  const next = () => {
    if (isLast) {
      impactH();
      onDone();
      return;
    }
    tapH();
    setIndex((i) => i + 1);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="box-none">
      <AuroraBackground />

      {/* Atla — sağ üst */}
      <Pressable
        onPress={() => {
          tapH();
          onDone();
        }}
        hitSlop={12}
        style={[styles.skip, { top: insets.top + Space.md }]}
      >
        <Text style={[Type.label, { color: T.textDim }]}>{t("wt_skip")}</Text>
      </Pressable>

      {/* Orta — emoji dairesi + başlık + açıklama */}
      <View style={styles.center}>
        <Animated.View
          key={`art-${index}`}
          entering={FadeIn.duration(420)}
          style={{ alignItems: "center" }}
        >
          <LinearGradient
            colors={T.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.circle,
              { width: circle, height: circle, borderRadius: circle / 2 },
              glow(T.primary, 32, 0.55),
            ]}
          >
            <Text style={{ fontSize: circle * 0.4 }}>{slide.emoji}</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          key={`txt-${index}`}
          entering={FadeInDown.duration(460).delay(80)}
          style={styles.textWrap}
        >
          <Text style={[Type.hero, styles.title, { color: T.text }]}>{t(slide.titleKey)}</Text>
          <Text style={[Type.body, styles.body, { color: T.textDim }]}>{t(slide.bodyKey)}</Text>
        </Animated.View>
      </View>

      {/* Alt — noktalar + İleri/Başla */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Space.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.titleKey}
              style={[
                styles.dot,
                i === index
                  ? { width: 22, backgroundColor: T.primary }
                  : { width: 7, backgroundColor: T.hairline },
              ]}
            />
          ))}
        </View>

        <Pressable onPress={next} style={styles.cta}>
          <LinearGradient
            colors={T.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaInner, glow(T.primary, 20, 0.5)]}
          >
            <Text style={[Type.title, { color: "#fff" }]}>{isLast ? t("wt_start") : t("wt_next")}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000 },
  skip: {
    position: "absolute",
    right: Space.xl,
    zIndex: 2,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.xxl,
    gap: Space.xxl,
  },
  circle: { alignItems: "center", justifyContent: "center" },
  textWrap: { alignItems: "center", gap: Space.md },
  title: { textAlign: "center" },
  body: { textAlign: "center", maxWidth: 320 },
  footer: { paddingHorizontal: Space.xl, gap: Space.xl },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Space.sm },
  dot: { height: 7, borderRadius: Radius.pill },
  cta: { borderRadius: Radius.pill, overflow: "hidden" },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
});
