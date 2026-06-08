import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { SectionHeader } from "@/ui/atoms";
import { fetchCourseGroups, courseEmoji, type Course, type CourseGroup } from "@/lib/courses";

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

/** Tek bir kurs satırı: solda görsel/emoji kutusu, sağda ad + merkez + saat + belediye. */
export function CourseRow({
  course,
  providerName,
  city,
  url,
  grad,
  T,
  delay,
}: {
  course: Course;
  providerName: string;
  city?: string;
  url?: string;
  grad: readonly [string, string];
  T: Palette;
  delay: number;
}) {
  const open = () => {
    tapH();
    router.push({
      pathname: "/kurs",
      params: {
        name: course.name,
        center: course.center ?? "",
        schedule: course.schedule ?? "",
        image: course.image ?? "",
        provider: providerName,
        city: city ?? "",
        url: url ?? "",
      },
    });
  };
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(delay)}>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: Space.md,
            padding: Space.sm,
            borderRadius: Radius.lg,
            backgroundColor: T.surface,
            borderWidth: 1,
            borderColor: T.hairline,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        {/* Görsel ya da gradient + emoji kutusu */}
        {course.image ? (
          <Image
            source={{ uri: course.image }}
            style={{ width: 64, height: 64, borderRadius: Radius.md, backgroundColor: T.surfaceStrong }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient
            colors={grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              { width: 64, height: 64, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
              glow(grad[0], 10, 0.4),
            ]}
          >
            <Text style={{ fontSize: 30 }}>{courseEmoji(course.name)}</Text>
          </LinearGradient>
        )}

        {/* Bilgiler */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[Type.title, { color: T.text }]} numberOfLines={2}>
            {course.name}
          </Text>
          {course.center ? (
            <Text style={[Type.body, { color: T.textDim }]} numberOfLines={1}>
              📍 {course.center}
            </Text>
          ) : null}
          {course.schedule ? (
            <Text style={[Type.body, { color: T.textDim }]} numberOfLines={1}>
              🕐 {course.schedule}
            </Text>
          ) : null}
          <Text style={[Type.micro, { color: T.textFaint, marginTop: 1 }]} numberOfLines={1}>
            {providerName}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Anasayfa "Ücretsiz Kurslar" bölümü — SADECE aktif şehrin belediye kurslarını
 * dikey liste (kart satırları) olarak gösterir. Bu şehirde kurs yoksa hiç render etmez.
 */
export function CourseSection() {
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const [groups, setGroups] = useState<CourseGroup[]>([]);

  useEffect(() => {
    let alive = true;
    fetchCourseGroups(city ?? undefined).then((g) => {
      if (alive) setGroups(g);
    });
    return () => {
      alive = false;
    };
  }, [city]);

  // Grupları tek bir dikey listeye düzleştir (belediye sırası → renk çeşitliliği).
  const rows: Row[] = [];
  groups.forEach((g, gi) => {
    const providerName = g.provider.name.split("—")[0]?.trim() || g.provider.name;
    const url = g.provider.registerUrl ?? g.provider.listUrl;
    g.courses.forEach((c, ci) => {
      rows.push({
        key: `${g.provider.key}-${ci}-${c.name}`,
        course: c,
        providerName,
        city: g.provider.city,
        url,
        gradIdx: gi + ci,
      });
    });
  });

  // Bu şehirde hiç kurs yoksa bölümü tamamen gizle.
  if (rows.length === 0) return null;

  const shown = rows.slice(0, 5);

  return (
    <View style={{ marginTop: Space.xl, marginBottom: Space.xl }}>
      <SectionHeader
        title="Ücretsiz Kurslar"
        action={
          <Pressable onPress={() => { tapH(); router.push("/kurslar"); }} hitSlop={8}>
            <Text style={[Type.label, { color: T.primary }]}>Tümü →</Text>
          </Pressable>
        }
      />
      <View style={{ gap: Space.sm }}>
        {shown.map((r, i) => (
          <CourseRow
            key={r.key}
            course={r.course}
            providerName={r.providerName}
            city={r.city}
            url={r.url}
            grad={gradientFor(T, r.gradIdx)}
            T={T}
            delay={Math.min(i, 6) * 60}
          />
        ))}
      </View>
    </View>
  );
}
