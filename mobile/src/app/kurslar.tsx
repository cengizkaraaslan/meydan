import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { Loader, EmptyState } from "@/ui/atoms";
import { tapH } from "@/lib/haptics";
import { API_BASE } from "@/lib/api";
import { fetchCourseGroups, courseEmoji, type CourseGroup } from "@/lib/courses";

/** Belediye sırasına göre dönüşümlü gradientler. */
function gradientFor(T: Palette, idx: number): readonly [string, string] {
  const palettes: readonly (readonly [string, string])[] = [
    [T.violet, T.blue],
    [T.pink, T.violet],
    [T.cyan, T.blue],
    [T.gold, T.pink],
    [T.indigo, T.cyan],
    [T.primary, T.violet],
  ];
  return palettes[idx % palettes.length];
}

function CourseCard({
  name,
  center,
  grad,
  delay,
  onPress,
}: {
  name: string;
  center?: string;
  grad: readonly [string, string];
  delay: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)} style={{ flex: 1 }}>
      <Pressable
        onPress={() => { tapH(); onPress(); }}
        style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      >
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, glow(grad[0], 14, 0.4)]}
        >
          <Text style={{ fontSize: 28 }}>{courseEmoji(name)}</Text>
          <View>
            <Text style={[Type.title, { color: "#fff" }]} numberOfLines={2}>{name}</Text>
            {center ? (
              <Text style={[Type.micro, { color: "rgba(255,255,255,0.85)", marginTop: 4 }]} numberOfLines={1}>
                📍 {center}
              </Text>
            ) : null}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/** Branş kartlarını ikişerli satırlara böler (grid görünümü). */
function rows<T>(arr: T[]): [T, T?][] {
  const out: [T, T?][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push([arr[i], arr[i + 1]]);
  return out;
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const [groups, setGroups] = useState<CourseGroup[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCourseGroups().then((g) => {
      if (alive) setGroups(g);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Branşı olan belediyeleri öne al.
  const withCourses = (groups ?? [])
    .filter((g) => g.courses.length > 0)
    .sort((a, b) => b.courses.length - a.courses.length);

  const total = withCourses.reduce((s, g) => s + g.courses.length, 0);

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 60, paddingHorizontal: 16, flexGrow: 1 }}
      >
        {/* Başlık + geri */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={10}
            accessibilityLabel="Geri"
            style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>←</Text>
          </Pressable>
          <Text style={[Type.h1, { color: T.text }]}>Ücretsiz Kurslar</Text>
          <View style={{ width: 40 }} />
        </View>

        {groups === null ? (
          <Loader label="Kurslar yükleniyor…" />
        ) : withCourses.length === 0 ? (
          <EmptyState
            emoji="🎓"
            title="Şu an branş listesi yok"
            sub="Belediye kayıt dönemleri kapalı olabilir. Daha sonra tekrar bak."
          />
        ) : (
          <View style={{ gap: Space.xl }}>
            <Text style={[Type.body, { color: T.textDim, marginTop: -4 }]}>
              Belediyelerin ücretsiz meslek ve sanat kursları · {total} branş
            </Text>

            {withCourses.map((g, gi) => {
              const grad = gradientFor(T, gi);
              const name = g.provider.name.split("—")[0]?.trim() || g.provider.name;
              return (
                <View key={g.provider.key} style={{ gap: Space.md }}>
                  <Animated.View entering={FadeInDown.duration(400).delay(gi * 80)}>
                    <View style={styles.groupHead}>
                      <View style={[styles.dot, { backgroundColor: grad[0] }]} />
                      <Text style={[Type.h2, { color: T.text }]}>{name}</Text>
                      <Text style={[Type.label, { color: T.textFaint }]}>· {g.provider.city}</Text>
                    </View>
                  </Animated.View>

                  {rows(g.courses.slice(0, 40)).map((pair, ri) => (
                    <View key={ri} style={{ flexDirection: "row", gap: Space.md }}>
                      {pair.map((c, ci) =>
                        c ? (
                          <CourseCard
                            key={`${ri}-${ci}-${c.name}`}
                            name={c.name}
                            center={c.center}
                            grad={grad}
                            delay={Math.min(gi * 4 + ri, 10) * 40}
                            onPress={() => Linking.openURL(`${API_BASE}/kurslar`).catch(() => {})}
                          />
                        ) : (
                          <View key={`${ri}-empty`} style={{ flex: 1 }} />
                        ),
                      )}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Space.lg },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: {
    minHeight: 130,
    borderRadius: Radius.lg,
    padding: Space.md,
    justifyContent: "space-between",
    gap: Space.sm,
  },
});
