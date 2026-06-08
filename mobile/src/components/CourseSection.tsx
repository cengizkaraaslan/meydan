import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { SectionHeader } from "@/ui/atoms";
import { fetchCourseGroups, courseEmoji, type CourseGroup } from "@/lib/courses";

/** Belediyeye göre dönüşümlü canlı gradientler (görselsiz kartları renklendirir). */
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

const CARD_W = 200;

function CourseCard({
  course,
  providerName,
  grad,
  delay,
}: {
  course: { name: string; center?: string };
  providerName: string;
  grad: readonly [string, string];
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)}>
      <Pressable
        onPress={() => { tapH(); router.push("/kurslar"); }}
        style={({ pressed }) => [{ width: CARD_W }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
      >
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            {
              height: 142,
              borderRadius: Radius.lg,
              padding: Space.md,
              justifyContent: "space-between",
            },
            glow(grad[0], 16, 0.45),
          ]}
        >
          <Text style={{ fontSize: 30 }}>{courseEmoji(course.name)}</Text>
          <View>
            <Text style={[Type.title, { color: "#fff" }]} numberOfLines={2}>
              {course.name}
            </Text>
            {course.center ? (
              <Text style={[Type.micro, { color: "rgba(255,255,255,0.85)", marginTop: 4 }]} numberOfLines={1}>
                📍 {course.center}
              </Text>
            ) : null}
            <Text style={[Type.micro, { color: "rgba(255,255,255,0.75)", marginTop: 2 }]} numberOfLines={1}>
              {providerName}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

interface FlatCourse {
  key: string;
  name: string;
  center?: string;
  providerName: string;
  gradIdx: number;
}

/**
 * Anasayfa "Ücretsiz Kurslar" bölümü — aktif şehre göre belediye branşlarını
 * yatay, animasyonlu kart şeridi olarak gösterir. Kurs yoksa hiç render etmez.
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

  // Grupları tek bir yatay listeye düzleştir (belediye sırası → renk çeşitliliği).
  const cards: FlatCourse[] = [];
  groups.forEach((g, gi) => {
    g.courses.slice(0, 12).forEach((c, ci) => {
      cards.push({
        key: `${g.provider.key}-${ci}-${c.name}`,
        name: c.name,
        center: c.center,
        providerName: g.provider.name.split("—")[0]?.trim() || g.provider.name,
        gradIdx: gi,
      });
    });
  });

  if (cards.length === 0) return null;

  const shown = cards.slice(0, 24);

  return (
    <View style={{ marginBottom: Space.xl }}>
      <SectionHeader
        title="Ücretsiz Kurslar"
        action={
          <Pressable onPress={() => { tapH(); router.push("/kurslar"); }} hitSlop={8}>
            <Text style={[Type.label, { color: T.primary }]}>Tümü →</Text>
          </Pressable>
        }
      />
      <FlatList
        horizontal
        data={shown}
        keyExtractor={(it) => it.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Space.md, paddingRight: Space.md }}
        renderItem={({ item, index }) => (
          <CourseCard
            course={{ name: item.name, center: item.center }}
            providerName={item.providerName}
            grad={gradientFor(T, item.gradIdx)}
            delay={Math.min(index, 8) * 60}
          />
        )}
      />
    </View>
  );
}
