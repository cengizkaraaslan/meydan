import React, { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../lib/theme";

/**
 * Zengin, sinematik aurora: koyu zemin + yavaşça süzülen 3 yumuşak ışıma
 * (temadan türetilen renklerle) + üst/alt vignette ile derinlik.
 * Performans için en fazla 3 animasyonlu katman; grain/nokta yok.
 */
function Glow({
  colors,
  size,
  style,
  duration,
  opacity,
  drift,
}: {
  colors: readonly [string, string];
  size: number;
  style: ViewStyle;
  duration: number;
  opacity: number;
  drift: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [t, duration]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (t.value - 0.5) * drift },
      { translateX: (t.value - 0.5) * (drift * 0.4) },
      { scale: 0.95 + t.value * 0.12 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size, opacity }, style, aStyle]}
    >
      <LinearGradient
        colors={[colors[0], colors[1], "transparent"]}
        style={{ flex: 1, borderRadius: size / 2 }}
        start={{ x: 0.3, y: 0.2 }}
        end={{ x: 0.8, y: 0.9 }}
      />
    </Animated.View>
  );
}

export function AuroraBackground() {
  const { t: T, name } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} pointerEvents="none">
      {/* 3 yumuşak ışıma — renkler temadan türetilir (primary + violet/blue/pink çeşitliliği) */}
      <Glow
        colors={[T.primary, "#1a0b2e"]}
        size={480}
        style={{ top: -180, left: -150 }}
        duration={15000}
        opacity={0.5}
        drift={56}
      />
      <Glow
        colors={[T.blue, "#0C1B4D"]}
        size={440}
        style={{ bottom: -170, right: -150 }}
        duration={18000}
        opacity={0.42}
        drift={64}
      />
      <Glow
        colors={[name === "pink" ? T.pink : T.violet, "#120826"]}
        size={520}
        style={{ top: "32%", right: -220 }}
        duration={21000}
        opacity={0.36}
        drift={72}
      />

      {/* Üst vignette — kenarda koyulaşma, derinlik */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(8,7,13,0.55)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220 }}
      />
      {/* Alt vignette — kenarda koyulaşma, derinlik */}
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(8,7,13,0.65)"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260 }}
      />

      {/* okunabilirlik için en üstte koyu vual — KORUNUR */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,7,13,0.5)" }]} />
    </View>
  );
}
