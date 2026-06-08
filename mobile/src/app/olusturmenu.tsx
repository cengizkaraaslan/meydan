import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH } from "@/lib/haptics";

/** Büyük seçim kartı (emoji + başlık + alt metin). */
function OptionCard({
  icon,
  title,
  sub,
  accent,
  T,
  onPress,
  delay,
}: {
  icon: string;
  title: string;
  sub: string;
  accent: string;
  T: Palette;
  onPress: () => void;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delay)}>
      <Pressable
        onPress={() => { tapH(); onPress(); }}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: T.surfaceStrong, borderColor: T.hairline },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: T.surface }, glow(accent, 12, 0.4)]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.h2, { color: T.text }]}>{title}</Text>
          <Text style={[Type.body, { color: T.textDim, marginTop: 4 }]}>{sub}</Text>
        </View>
        <Text style={[Type.h2, { color: T.textFaint }]}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function CreateMenuScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}
      >
        {/* Başlık + geri */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={10}
            accessibilityLabel={t("back")}
            style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>←</Text>
          </Pressable>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ gap: Space.lg, marginTop: Space.md }}>
          <OptionCard
            icon="🎉"
            title={t("create_new_event")}
            sub={t("create_new_event_sub")}
            accent={T.primary}
            T={T}
            delay={80}
            onPress={() => router.replace("/olustur")}
          />
          <OptionCard
            icon="📋"
            title={t("my_events")}
            sub={t("my_events_sub")}
            accent={T.cyan}
            T={T}
            delay={160}
            onPress={() => router.replace("/etkinliklerim")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Space.sm },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  iconWrap: { width: 56, height: 56, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 28 },
});
