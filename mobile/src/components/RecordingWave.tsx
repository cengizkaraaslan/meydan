import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const BARS = 22;

/** Tek ekolayzer çubuğu — her biri farklı süre/gecikmeyle yukarı-aşağı zıplar. */
function Bar({ index, color }: { index: number; color: string }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    // Deterministik ama bar'dan bar'a değişen ritim → canlı "ekolayzer" hissi.
    const duration = 360 + ((index * 67) % 300);
    const delay = (index * 53) % 420;
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    return () => cancelAnimation(v);
  }, [index, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.22 + v.value * 0.78 }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

/** WhatsApp tarzı kayıt göstergesi: ortadan büyüyüp küçülen animasyonlu çubuklar. */
export function RecordingWave({ color }: { color: string }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: BARS }).map((_, i) => (
        <Bar key={i} index={i} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3, height: 24, overflow: "hidden" },
  bar: { flex: 1, height: 22, borderRadius: 2 },
});
