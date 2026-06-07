import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuroraBackground } from "@/components/AuroraBackground";
import { GlassCard } from "@/components/GlassCard";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { PEOPLE } from "@/lib/people";
import { useAuth } from "@/lib/auth";
import { isAdmin, ADMIN_EMAIL, KEY_EXTRA_ADMINS } from "@/lib/admin";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH } from "@/lib/haptics";

function StatLine({ T, icon, label, value }: { T: Palette; icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[Type.label, { color: T.textDim, flex: 1 }]}>{label}</Text>
      <Text style={[Type.title, { color: T.text }]}>{value}</Text>
    </View>
  );
}

/** Deterministik placeholder istatistik (id'den). Postgres bağlanınca gerçek API ile değişecek. */
function hashNum(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}
function statsFor(id: string): { joined: Date; stories: number; photos: number } {
  const daysAgo = 7 + hashNum(id + "j", 400);
  return {
    joined: new Date(Date.now() - daysAgo * 86400000),
    stories: hashNum(id + "s", 14),
    photos: hashNum(id + "p", 28),
  };
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t: T } = useTheme();
  const { t } = useT();
  const [admins, setAdmins] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  // Cihazdaki ek admin id'lerini yükle.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY_EXTRA_ADMINS);
        if (alive && raw) setAdmins(new Set(JSON.parse(raw) as string[]));
      } catch {
        /* yok say */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Admin değilse içeri girince ana sayfaya at.
  if (!isAdmin(user)) {
    router.replace("/");
    return null;
  }

  const toggle = (id: string) => {
    tapH();
    setAdmins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(KEY_EXTRA_ADMINS, JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />

      {/* Başlık + geri */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => { tapH(); router.back(); }}
          hitSlop={12}
          style={[styles.back, { backgroundColor: "rgba(0,0,0,0.45)", borderColor: T.hairline }]}
        >
          <Text style={{ color: "#fff", fontSize: 20 }}>←</Text>
        </Pressable>
        <Text style={[Type.h1, { color: T.text }]}>{t("admin_panel")}</Text>
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
                {t("admin_badge")}: <Text style={{ color: T.gold }}>{ADMIN_EMAIL}</Text>
              </Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Kullanıcılar */}
        <Animated.View entering={FadeInDown.duration(450).delay(60)} style={styles.sectionRow}>
          <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: T.primary }} />
          <Text style={[Type.h2, { color: T.text }]}>{t("admin_users")}</Text>
        </Animated.View>

        <View style={{ gap: Space.md }}>
          {PEOPLE.map((p, i) => {
            const on = admins.has(p.id);
            return (
              <Animated.View key={p.id} entering={FadeInDown.duration(420).delay(100 + i * 35)}>
                <GlassCard padded glowColor={on ? T.primary : undefined}>
                  <View style={styles.userRow}>
                    <Pressable
                      onPress={() => { tapH(); setExpanded((e) => (e === p.id ? null : p.id)); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: Space.md, flex: 1 }}
                    >
                      <Image source={{ uri: p.avatar }} style={[styles.avatar, glow(T.primary, 10, 0.4)]} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={[Type.title, { color: T.text }]}>{p.name}</Text>
                        <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>
                          {p.city}
                          {on ? ` · ${t("admin_badge")}` : ""}
                        </Text>
                      </View>
                      <Text style={[Type.h2, { color: T.textFaint }]}>{expanded === p.id ? "▾" : "▸"}</Text>
                    </Pressable>

                    <Pressable onPress={() => toggle(p.id)} style={{ borderRadius: Radius.pill, overflow: "hidden" }}>
                      {on ? (
                        <View style={[styles.toggle, { backgroundColor: T.surfaceStrong, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: T.hairline }]}>
                          <Text style={[Type.label, { color: T.pink }]}>{t("remove_admin")}</Text>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={T.primarySoft}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.toggle}
                        >
                          <Text style={[Type.label, { color: "#fff" }]}>{t("make_admin")}</Text>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </View>

                  {expanded === p.id ? (
                    <Animated.View entering={FadeInDown.duration(260)} style={[styles.expand, { borderTopColor: T.hairline }]}>
                      <StatLine T={T} icon="🗓️" label={t("member_since")} value={statsFor(p.id).joined.toLocaleDateString()} />
                      <StatLine T={T} icon="📸" label={t("stories_shared")} value={String(statsFor(p.id).stories)} />
                      <StatLine T={T} icon="🖼️" label={t("photos_shared")} value={String(statsFor(p.id).photos)} />
                    </Animated.View>
                  ) : null}
                </GlassCard>
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
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  toggle: { paddingHorizontal: 14, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  expand: { marginTop: Space.md, paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth * 2 },
});
