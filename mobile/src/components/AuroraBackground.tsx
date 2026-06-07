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
  const light = T.scheme === "light";

  // Işıma ikinci renkleri ve vignette'ler şemaya göre değişir: koyuda derin
  // koyu morlar + koyu vignette; açıkta yumuşak beyaza doğru sönüm (zemini
  // karartmadan ışıltı verir). Açık modda en üstteki koyu vual kaldırılır.
  const glowFade = light ? "rgba(255,255,255,0)" : "#1a0b2e";
  const glowFadeBlue = light ? "rgba(255,255,255,0)" : "#0C1B4D";
  const glowFadeViolet = light ? "rgba(255,255,255,0)" : "#120826";
  const topVignette: [string, string] = light
    ? ["rgba(246,245,251,0.65)", "transparent"]
    : ["rgba(8,7,13,0.55)", "transparent"];
  const bottomVignette: [string, string] = light
    ? ["transparent", "rgba(246,245,251,0.8)"]
    : ["transparent", "rgba(8,7,13,0.65)"];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} pointerEvents="none">
      {/* 3 yumuşak ışıma — renkler temadan türetilir (primary + violet/blue/pink çeşitliliği) */}
      <Glow
        colors={[T.primary, glowFade]}
        size={480}
        style={{ top: -180, left: -150 }}
        duration={15000}
        opacity={light ? 0.28 : 0.5}
        drift={56}
      />
      <Glow
        colors={[T.blue, glowFadeBlue]}
        size={440}
        style={{ bottom: -170, right: -150 }}
        duration={18000}
        opacity={light ? 0.22 : 0.42}
        drift={64}
      />
      <Glow
        colors={[name === "pink" ? T.pink : T.violet, glowFadeViolet]}
        size={520}
        style={{ top: "32%", right: -220 }}
        duration={21000}
        opacity={light ? 0.2 : 0.36}
        drift={72}
      />

      {/* Üst vignette — kenarda derinlik (şemaya göre) */}
      <LinearGradient
        pointerEvents="none"
        colors={topVignette}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220 }}
      />
      {/* Alt vignette — kenarda derinlik (şemaya göre) */}
      <LinearGradient
        pointerEvents="none"
        colors={bottomVignette}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260 }}
      />

      {/* Okunabilirlik için en üstte vual — yalnızca koyu modda (açıkta zemini karartmamak için yok) */}
      {!light && <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,7,13,0.5)" }]} />}
    </View>
  );
}
