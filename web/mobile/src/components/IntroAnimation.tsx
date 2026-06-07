import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Aurora, Type, glow } from "../theme/aurora";

/** Açılış tanıtım animasyonu: logo belirir → parlar → marka yazısı → fade-out. */
export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const container = useSharedValue(1);
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const ring = useSharedValue(0);
  const textY = useSharedValue(16);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSequence(
      withSpring(1.08, { damping: 9, stiffness: 120 }),
      withSpring(1, { damping: 12 }),
    );
    ring.value = withDelay(300, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    textOpacity.value = withDelay(550, withTiming(1, { duration: 500 }));
    textY.value = withDelay(550, withSpring(0, { damping: 13 }));

    container.value = withDelay(
      1750,
      withTiming(0, { duration: 480, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [container, logoOpacity, logoScale, ring, textOpacity, textY, onDone]);

  const cStyle = useAnimatedStyle(() => ({ opacity: container.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * 0.6,
    transform: [{ scale: 0.8 + ring.value * 1.6 }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, cStyle]}>
      <LinearGradient colors={["#0B0917", Aurora.bg]} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <View>
          {/* yayılan halka */}
          <Animated.View style={[styles.ring, ringStyle]} />
          {/* logo */}
          <Animated.View style={logoStyle}>
            <LinearGradient
              colors={Aurora.auroraGlow}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logo, glow("#7C3AED", 30, 0.7)]}
            >
              <Text style={styles.mark}>✦</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View style={[textStyle, { alignItems: "center", marginTop: 26 }]}>
          <Text style={[Type.hero, { color: Aurora.text }]}>
            Meydan<Text style={{ color: Aurora.violet }}>Fest</Text>
          </Text>
          <Text style={[Type.label, { color: Aurora.textFaint, marginTop: 6 }]}>
            Türkiye'nin etkinlik meydanı
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: Aurora.bg, zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 104, height: 104, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  mark: { fontSize: 50, color: "#fff" },
  ring: {
    position: "absolute", top: -38, left: -38, width: 180, height: 180, borderRadius: 90,
    borderWidth: 2, borderColor: Aurora.violet,
  },
});
