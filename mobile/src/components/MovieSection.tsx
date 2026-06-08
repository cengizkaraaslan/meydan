import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { fetchMovies, type Movie } from "@/lib/cinema";

const CARD_W = 132;
const CARD_H = 198;

function MovieCard({ m, T, index }: { m: Movie; T: Palette; index: number }) {
  const [err, setErr] = useState(false);
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(index * 70)}>
      <Pressable
        onPress={() => { tapH(); router.push("/vizyon"); }}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.poster, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }, glow(T.primary, 14, 0.25)]}>
          {err ? (
            <View style={[styles.posterPlaceholder, { backgroundColor: T.surface }]}>
              <Text style={{ fontSize: 32 }}>🎬</Text>
            </View>
          ) : (
            <Image
              source={{ uri: m.posterUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              onError={() => setErr(true)}
            />
          )}
        </View>
        <Text style={[Type.label, { color: T.text, marginTop: Space.sm }]} numberOfLines={1}>
          {m.title}
        </Text>
        <Text style={[Type.micro, { color: T.gold, marginTop: 2 }]} numberOfLines={1}>
          ⭐ {m.rating.toFixed(1)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function MovieSection() {
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const [movies, setMovies] = useState<Movie[]>([]);

  useEffect(() => {
    let alive = true;
    fetchMovies(city ?? undefined).then((list) => {
      if (alive) setMovies(list);
    });
    return () => {
      alive = false;
    };
  }, [city]);

  if (movies.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[Type.h2, { color: T.text }]}>Vizyondaki Filmler</Text>
        <Pressable onPress={() => { tapH(); router.push("/vizyon"); }} hitSlop={8}>
          <Text style={[Type.label, { color: T.primary }]}>Tümü →</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {movies.map((m, i) => (
          <MovieCard key={m.id} m={m} T={T} index={i} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: Space.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.lg,
    marginBottom: Space.md,
  },
  list: { paddingHorizontal: Space.lg, gap: Space.md },
  card: { width: CARD_W },
  poster: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
  },
  posterPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
