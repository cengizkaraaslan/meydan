import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useAuth } from "@/lib/auth";
import { isAdmin, ADMIN_EMAIL } from "@/lib/admin";
import { useTheme, type Palette } from "@/lib/theme";
import { tapH } from "@/lib/haptics";

interface HubItem {
  icon: string;
  title: string;
  subtitle: string;
  route: string;
  color: (T: Palette) => string;
}

const ITEMS: HubItem[] = [
  {
    icon: "👥",
    title: "Kullanıcılar",
    subtitle: "Gerçek ve cihaz kullanıcıları, kayıt ve aktivite",
    route: "/admin/kullanicilar",
    color: (T) => T.cyan,
  },
  {
    icon: "🤖",
    title: "Botlar / Scraper",
    subtitle: "Etkinlik botlarını izle ve tetikle",
    route: "/admin/scraper",
    color: (T) => T.gold,
  },
];

export default function AdminHubScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t: T } = useTheme();

  // Admin değilse içeri girince ana sayfaya at.
  if (!isAdmin(user)) {
    router.replace("/");
    return null;
  }

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => { tapH(); router.back(); }}
          hitSlop={12}
          style={[styles.back, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
        >
          <Text style={{ color: T.text, fontSize: 20 }}>←</Text>
        </Pressable>
        <Text style={[Type.h1, { color: T.text }]}>Admin Yönetim Paneli</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
      >
        {/* Kurucu admin notu */}
        <Animated.View entering={FadeInDown.duration(450)}>
          <View style={[styles.card, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, marginBottom: Space.xl }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Space.md }}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
              <Text style={[Type.label, { color: T.textDim, flex: 1, lineHeight: 17 }]}>
                Yönetici: <Text style={{ color: T.gold }}>{ADMIN_EMAIL}</Text>
              </Text>
            </View>
          </View>
        </Animated.View>

        <View style={{ gap: Space.lg }}>
          {ITEMS.map((it, i) => {
            const accent = it.color(T);
            return (
              <Animated.View key={it.route} entering={FadeInDown.duration(420).delay(80 + i * 60)}>
                <Pressable onPress={() => { tapH(); router.push(it.route as never); }}>
                  <View style={[styles.card, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }, glow(accent, 16, 0.25)]}>
                    <View style={styles.cardRow}>
                      <View style={[styles.iconBox, { backgroundColor: T.surface, borderColor: T.hairline }]}>
                        <Text style={{ fontSize: 26 }}>{it.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Type.h2, { color: T.text }]}>{it.title}</Text>
                        <Text style={[Type.label, { color: T.textFaint, marginTop: 4, lineHeight: 16 }]}>
                          {it.subtitle}
                        </Text>
                      </View>
                      <Text style={[Type.h2, { color: accent }]}>›</Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: Space.md,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 16,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: Space.lg },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
