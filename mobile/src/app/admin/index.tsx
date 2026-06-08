import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { GlassCard } from "@/components/GlassCard";
import { Radius, Space, Type } from "@/theme/aurora";
import { useAuth } from "@/lib/auth";
import { isAdmin, ADMIN_EMAIL } from "@/lib/admin";
import { useTheme, type Palette } from "@/lib/theme";
import { tapH } from "@/lib/haptics";

interface HubItem {
  icon: string;
  title: string;
  subtitle: string;
  route: "/admin/kullanicilar" | "/admin/scraper";
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
          style={[styles.back, { backgroundColor: "rgba(0,0,0,0.45)", borderColor: T.hairline }]}
        >
          <Text style={{ color: "#fff", fontSize: 20 }}>←</Text>
        </Pressable>
        <Text style={[Type.h1, { color: T.text }]}>Yönetim</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
      >
        {/* Kurucu admin notu */}
        <Animated.View entering={FadeInDown.duration(450)}>
          <GlassCard glowColor={T.gold} style={{ marginBottom: Space.xl }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Space.md }}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
              <Text style={[Type.label, { color: T.textDim, flex: 1, lineHeight: 17 }]}>
                Yönetici: <Text style={{ color: T.gold }}>{ADMIN_EMAIL}</Text>
              </Text>
            </View>
          </GlassCard>
        </Animated.View>

        <View style={{ gap: Space.lg }}>
          {ITEMS.map((it, i) => {
            const accent = it.color(T);
            return (
              <Animated.View key={it.route} entering={FadeInDown.duration(420).delay(80 + i * 60)}>
                <Pressable onPress={() => { tapH(); router.push(it.route); }}>
                  <GlassCard glowColor={accent}>
                    <View style={styles.cardRow}>
                      <View style={[styles.iconBox, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
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
                  </GlassCard>
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
