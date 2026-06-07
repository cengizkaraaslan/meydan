import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "./AuroraBackground";
import { Radius, Type, glow } from "../theme/aurora";
import { useTheme, themeForGender, type Gender } from "../lib/theme";
import { useT } from "../lib/i18n";
import { syncProfile } from "../lib/profileSync";
import { mediumH } from "../lib/haptics";

/**
 * Cinsiyet onboarding'i — route değil, tam ekran OVERLAY (zIndex yüksek).
 * authed && gender===null iken gösterilir; seçim yapılınca state değişip kaybolur.
 */
export function GenderOnboarding() {
  const insets = useSafeAreaInsets();
  const { t: T, setGender, setTheme } = useTheme();
  const { t } = useT();

  const pick = (g: Gender) => {
    mediumH();
    setTheme(themeForGender(g));
    syncProfile({ gender: g });
    setGender(g); // en son: bu state değişimi overlay'i kapatır
  };

  const opts: { g: Gender; label: string; emoji: string; grad: readonly [string, string] }[] = [
    { g: "male", label: t("male"), emoji: "👨", grad: ["#3B82F6", "#1D4ED8"] },
    { g: "female", label: t("female"), emoji: "👩", grad: ["#EC4899", "#A855F7"] },
    { g: "other", label: t("other"), emoji: "✨", grad: ["#8B5CF6", "#3B82F6"] },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
      <AuroraBackground />
      <View style={[styles.wrap, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30 }]}>
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center" }}>
          <Text style={[Type.hero, { color: T.text, textAlign: "center" }]}>{t("ob_welcome")}</Text>
          <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: 10 }]}>{t("ob_gender_q")}</Text>
        </Animated.View>

        <View style={{ gap: 14 }}>
          {opts.map((o, i) => (
            <Animated.View key={o.g ?? "x"} entering={FadeInDown.delay(200 + i * 120).duration(500)}>
              <Pressable onPress={() => pick(o.g)} style={{ borderRadius: Radius.lg, overflow: "hidden" }}>
                <LinearGradient colors={o.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.opt, glow(o.grad[0], 16, 0.4)]}>
                  <Text style={{ fontSize: 26 }}>{o.emoji}</Text>
                  <Text style={[Type.title, { color: "#fff" }]}>{o.label}</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Animated.Text entering={FadeIn.delay(700)} style={[Type.label, { color: T.textFaint, textAlign: "center" }]}>
          {t("terms")}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  opt: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 20, paddingHorizontal: 22 },
});
