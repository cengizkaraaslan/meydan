import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { CourseRow } from "@/components/CourseSection";
import { Space, Type } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { Loader, EmptyState } from "@/ui/atoms";
import { tapH } from "@/lib/haptics";
import { fetchCourseGroups, type Course, type CourseGroup } from "@/lib/courses";

/** Kurs sırasına göre dönüşümlü canlı gradientler (görselsiz kutuları renklendirir). */
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

interface Row {
  key: string;
  course: Course;
  providerName: string;
  city?: string;
  url?: string;
  gradIdx: number;
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const [groups, setGroups] = useState<CourseGroup[] | null>(null);

  useEffect(() => {
    let alive = true;
    setGroups(null);
    fetchCourseGroups(city ?? undefined).then((g) => {
      if (alive) setGroups(g);
    });
    return () => {
      alive = false;
    };
  }, [city]);

  // Seçili şehrin tüm kurslarını tek dikey listeye düzleştir.
  const rows: Row[] = [];
  let fallbackUrl: string | undefined;
  (groups ?? []).forEach((g, gi) => {
    const providerName = g.provider.name.split("—")[0]?.trim() || g.provider.name;
    const url = g.provider.registerUrl ?? g.provider.listUrl;
    if (!fallbackUrl && url) fallbackUrl = url;
    g.courses.forEach((c, ci) => {
      rows.push({
        key: `${g.provider.key}-${ci}-${c.name}`,
        course: c,
        providerName,
        // Ulusal kaynakta (İŞKUR) kursun KENDİ ili + kursa özel başvuru url'i.
        city: c.city ?? g.provider.city,
        url: c.url ?? url,
        gradIdx: gi + ci,
      });
    });
  });

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
        ) : rows.length === 0 ? (
          <View style={{ gap: Space.lg }}>
            <EmptyState
              emoji="🎓"
              title="Bu şehirde kurs bulunamadı"
              sub={city ? `${city} için belediye kayıt dönemi kapalı olabilir. Daha sonra tekrar bak.` : "Daha sonra tekrar bak."}
            />
            {fallbackUrl ? (
              <Pressable
                onPress={() => { tapH(); Linking.openURL(fallbackUrl!).catch(() => {}); }}
                style={{ alignSelf: "center" }}
                hitSlop={8}
              >
                <Text style={[Type.label, { color: T.primary }]}>Belediye sitesine git →</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: Space.lg }}>
            <Text style={[Type.body, { color: T.textDim, marginTop: -4 }]}>
              {city ? `${city} belediyelerinin` : "Belediyelerin"} ücretsiz meslek ve sanat kursları · {rows.length} kurs
            </Text>

            <Animated.View entering={FadeInDown.duration(380)} style={{ gap: Space.sm }}>
              {rows.map((r, i) => (
                <CourseRow
                  key={r.key}
                  course={r.course}
                  providerName={r.providerName}
                  city={r.city}
                  url={r.url}
                  grad={gradientFor(T, r.gradIdx)}
                  T={T}
                  delay={Math.min(i, 10) * 40}
                />
              ))}
            </Animated.View>
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
});
