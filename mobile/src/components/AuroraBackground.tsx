import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  Canvas,
  Fill,
  Shader,
  Skia,
  useClock,
} from "@shopify/react-native-skia";
import { useTheme, type Palette } from "../lib/theme";

/**
 * Sinematik aurora arka planı. Birincil: Skia runtime shader (SkSL) ile akan
 * "mesh gradient" — temadan türetilen 3 renk yumuşak metaball gibi süzülür
 * (Android'de çalışır; expo-mesh-gradient iOS-only olduğu için Skia tercih edildi).
 * Shader derlenemezse (eski cihaz/web) reanimated tabanlı ışıma fallback'i devreye girer.
 */

// ── SkSL: akan aurora. 3 hareketli renk merkezi + koyu zemin üzerine gaussian karışım.
const AURORA_SKSL = `
uniform float u_time;
uniform float2 u_res;
uniform float4 u_bg;
uniform float4 u_c1;
uniform float4 u_c2;
uniform float4 u_c3;

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  // Yavaşça dolaşan üç merkez.
  float2 p1 = float2(0.25 + 0.16 * sin(u_time * 0.20), 0.22 + 0.12 * cos(u_time * 0.23));
  float2 p2 = float2(0.80 + 0.14 * cos(u_time * 0.17), 0.78 + 0.12 * sin(u_time * 0.19));
  float2 p3 = float2(0.55 + 0.20 * sin(u_time * 0.13), 0.45 + 0.16 * cos(u_time * 0.15));
  // Gaussian düşüş — yumuşak ışıma blob'ları.
  float d1 = exp(-dot(uv - p1, uv - p1) * 5.5);
  float d2 = exp(-dot(uv - p2, uv - p2) * 5.5);
  float d3 = exp(-dot(uv - p3, uv - p3) * 5.5);
  half3 col = u_bg.rgb;
  col = mix(col, u_c1.rgb, clamp(d1 * u_c1.a, 0.0, 1.0));
  col = mix(col, u_c2.rgb, clamp(d2 * u_c2.a, 0.0, 1.0));
  col = mix(col, u_c3.rgb, clamp(d3 * u_c3.a, 0.0, 1.0));
  return half4(col, 1.0);
}
`;

/** "#rrggbb" → [r,g,b] 0..1. Bilinmeyen formatta koyu mor döner. */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.1, 0.05, 0.18];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Skia shader tabanlı canlı aurora. effect compile başarılı olduğunda render edilir. */
function AuroraShader({ T, name, effect }: { T: Palette; name: string; effect: ReturnType<typeof Skia.RuntimeEffect.Make> }) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();
  const light = T.scheme === "light";

  const bg = useMemo<[number, number, number]>(() => hexToRgb(T.bg), [T.bg]);
  const c1 = useMemo<[number, number, number]>(() => hexToRgb(T.primary), [T.primary]);
  const c2 = useMemo<[number, number, number]>(() => hexToRgb(T.blue), [T.blue]);
  const c3 = useMemo<[number, number, number]>(() => hexToRgb(name === "pink" ? T.pink : T.violet), [T.pink, T.violet, name]);
  // Açık temada ışımalar daha hafif (zemini bozmasın).
  const a = light ? 0.45 : 0.85;

  const uniforms = useDerivedValue(() => ({
    u_time: clock.value / 1000,
    u_res: [width, height],
    u_bg: [bg[0], bg[1], bg[2], 1],
    u_c1: [c1[0], c1[1], c1[2], a],
    u_c2: [c2[0], c2[1], c2[2], a * 0.9],
    u_c3: [c3[0], c3[1], c3[2], a * 0.8],
  }), [width, height, bg, c1, c2, c3, a]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={effect!} uniforms={uniforms} />
        </Fill>
      </Canvas>
      {/* Kenar vignette'leri + okunabilirlik vuali (shader üstünde). */}
      <Vignettes light={light} />
    </View>
  );
}

/** Üst/alt vignette + koyu mod okunabilirlik vuali (her iki sürümde ortak). */
function Vignettes({ light }: { light: boolean }) {
  const topVignette: [string, string] = light
    ? ["rgba(246,245,251,0.55)", "transparent"]
    : ["rgba(8,7,13,0.5)", "transparent"];
  const bottomVignette: [string, string] = light
    ? ["transparent", "rgba(246,245,251,0.78)"]
    : ["transparent", "rgba(8,7,13,0.72)"];
  return (
    <>
      <LinearGradient pointerEvents="none" colors={topVignette} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220 }} />
      <LinearGradient pointerEvents="none" colors={bottomVignette} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260 }} />
      {!light && <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,7,13,0.42)" }]} />}
    </>
  );
}

// ── Fallback: reanimated ışıma (shader yoksa/eski cihaz).
function Glow({
  colors, size, style, duration, opacity, drift,
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
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, opacity }, style, aStyle]}>
      <LinearGradient colors={[colors[0], colors[1], "transparent"]} style={{ flex: 1, borderRadius: size / 2 }} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 0.9 }} />
    </Animated.View>
  );
}

function AuroraFallback({ T, name }: { T: Palette; name: string }) {
  const light = T.scheme === "light";
  const glowFade = light ? "rgba(255,255,255,0)" : "#1a0b2e";
  const glowFadeBlue = light ? "rgba(255,255,255,0)" : "#0C1B4D";
  const glowFadeViolet = light ? "rgba(255,255,255,0)" : "#120826";
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} pointerEvents="none">
      <Glow colors={[T.primary, glowFade]} size={480} style={{ top: -180, left: -150 }} duration={15000} opacity={light ? 0.28 : 0.5} drift={56} />
      <Glow colors={[T.blue, glowFadeBlue]} size={440} style={{ bottom: -170, right: -150 }} duration={18000} opacity={light ? 0.22 : 0.42} drift={64} />
      <Glow colors={[name === "pink" ? T.pink : T.violet, glowFadeViolet]} size={520} style={{ top: "32%", right: -220 }} duration={21000} opacity={light ? 0.2 : 0.36} drift={72} />
      <Vignettes light={light} />
    </View>
  );
}

export function AuroraBackground() {
  const { t: T, name } = useTheme();
  // Shader'ı Skia hazırken (render anında) derle; başarısızsa null → fallback.
  const effect = useMemo(() => {
    try {
      return Skia.RuntimeEffect.Make(AURORA_SKSL);
    } catch {
      return null;
    }
  }, []);
  // Shader derlendiyse Skia canlı aurora; değilse reanimated fallback.
  if (effect) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} pointerEvents="none">
        <AuroraShader T={T} name={name} effect={effect} />
      </View>
    );
  }
  return <AuroraFallback T={T} name={name} />;
}
