import React from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/GlassCard";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { getPerson } from "@/lib/people";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH, impactH } from "@/lib/haptics";

const { height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.58);

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const person = getPerson(String(id));

  if (!person) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Text style={[Type.h2, { color: T.text }]}>{t("person_not_found")}</Text>
        <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10}>
          <Text style={{ color: T.primary, marginTop: 8 }}>← {t("back")}</Text>
        </Pressable>
      </View>
    );
  }

  const isVeryClose = person.distanceKm < 2;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
      >
        {/* Hero görsel */}
        <View style={{ height: HERO_H, width: "100%" }}>
          <Image
            source={{ uri: person.avatar }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            recyclingKey={person.id}
          />
          {/* Alt karartma — metin okunaklı olsun + zemine erisin (görseli üstte fazla karartma) */}
          <LinearGradient
            colors={["transparent", "transparent", "rgba(8,7,13,0.3)", T.bg]}
            locations={[0, 0.5, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Geri butonu */}
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={12}
            style={[styles.back, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.45)", borderColor: T.hairline }]}
          >
            <Text style={{ color: "#fff", fontSize: 20 }}>←</Text>
          </Pressable>

          {/* Çevrimiçi rozeti */}
          {person.online && (
            <Animated.View
              entering={FadeIn.duration(450)}
              style={[styles.onlineBadge, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.45)", borderColor: T.success }]}
            >
              <View style={[styles.dot, { backgroundColor: T.success }]} />
              <Text style={[Type.micro, { color: T.success }]}>{t("online").toUpperCase()}</Text>
            </Animated.View>
          )}

          {/* İsim bloğu — görselin altına biner */}
          <Animated.View entering={FadeInDown.delay(80).duration(480)} style={styles.nameBlock}>
            <Text style={[Type.hero, { color: T.text }]}>
              {person.name}, {person.age}
            </Text>
            <Text style={[Type.body, { color: isVeryClose ? T.success : T.textDim, marginTop: 4, fontWeight: "700" }]}>
              {isVeryClose
                ? `📍 ${person.distanceKm} km · ${t("person_nearby")}`
                : `📍 ${person.distanceKm} km ${t("away")}`}
            </Text>
          </Animated.View>
        </View>

        {/* İçerik */}
        <View style={{ paddingHorizontal: 16, gap: 14, marginTop: 6 }}>
          {/* Hakkında */}
          <Animated.View entering={FadeInDown.delay(160).duration(460)}>
            <GlassCard glowColor={T.primary}>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: 8, letterSpacing: 0.6 }]}>
                {t("person_about").toUpperCase()}
              </Text>
              <Text style={[Type.body, { color: T.text, lineHeight: 21 }]}>{person.bio}</Text>
            </GlassCard>
          </Animated.View>

          {/* İlgi alanları */}
          <Animated.View entering={FadeInDown.delay(230).duration(460)}>
            <GlassCard>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: 10, letterSpacing: 0.6 }]}>
                {t("person_interests").toUpperCase()}
              </Text>
              <View style={styles.chips}>
                {person.interests.map((i) => (
                  <View
                    key={i}
                    style={[styles.chip, { borderColor: T.primary, backgroundColor: "rgba(168,85,247,0.14)" }]}
                  >
                    <Text style={[Type.label, { color: T.primary }]}>{i}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </Animated.View>

          {/* Mesaj Gönder */}
          <Animated.View entering={FadeInDown.delay(300).duration(460)} style={{ marginTop: 8 }}>
            <Pressable
              onPress={() => { impactH(); router.push(`/sohbet/${person.id}`); }}
              style={{ borderRadius: Radius.pill, overflow: "hidden" }}
            >
              <LinearGradient
                colors={T.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.msgBtn, glow(T.primary, 22, 0.55)]}
              >
                <Text style={{ fontSize: 17 }}>💬</Text>
                <Text style={[Type.title, { color: "#fff", fontSize: 17 }]}>{t("person_message")}</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: "absolute",
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  onlineBadge: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nameBlock: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Space.lg,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
});
