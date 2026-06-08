import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { MoviePoster } from "@/components/MoviePoster";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { fetchMovies, haversineKm, type Movie, type Showtime } from "@/lib/cinema";

interface NearbyShowtime extends Showtime {
  distanceKm: number | null;
}

/** durationMin → "2s 46d" (saat/dakika). 0/negatif → "—". */
function fmtDuration(min: number): string {
  if (!min || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}d`;
  if (m === 0) return `${h}s`;
  return `${h}s ${m}d`;
}

/** Mesafe + şehir filtreli seans listesi (artan mesafeye göre). */
function sortByDistance(list: NearbyShowtime[]): NearbyShowtime[] {
  return [...list].sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

function withDistance(
  s: Showtime,
  coords: { lat: number; lng: number } | null,
): NearbyShowtime {
  return {
    ...s,
    distanceKm:
      coords && s.lat != null && s.lng != null
        ? haversineKm(coords.lat, coords.lng, s.lat, s.lng)
        : null,
  };
}

function Chip({ label, T, tone }: { label: string; T: Palette; tone?: "primary" }) {
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: tone === "primary" ? T.bgElevated : T.surface,
          borderColor: tone === "primary" ? T.primary : T.hairline,
        },
      ]}
    >
      <Text style={[Type.micro, { color: tone === "primary" ? T.primary : T.textDim }]}>{label}</Text>
    </View>
  );
}

function TheaterRow({ s, T }: { s: NearbyShowtime; T: Palette }) {
  return (
    <View style={[styles.theaterRow, { backgroundColor: T.surface, borderColor: T.hairline }]}>
      <View style={styles.theaterHead}>
        <Text style={[Type.label, { color: T.text, flex: 1 }]} numberOfLines={1}>{s.theater}</Text>
        {s.distanceKm != null && (
          <Text style={[Type.micro, { color: T.primary }]}>{s.distanceKm.toFixed(1)} km</Text>
        )}
      </View>
      <View style={styles.times}>
        {s.times.map((tm) => (
          <View key={tm} style={[styles.timePill, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}>
            <Text style={[Type.micro, { color: T.textDim }]}>{tm}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function FilmScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Tüm filmleri çek (şehirsiz) — slug ile bul.
  useEffect(() => {
    let alive = true;
    fetchMovies().then((list) => {
      if (alive) setMovies(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Kullanıcı konumu (izin varsa) — sinemalara mesafe için.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        let granted = status === "granted";
        if (!granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === "granted";
        }
        if (!granted) return;
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (alive && pos) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* izin yok / hata → mesafe yok */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const movie = useMemo(() => movies?.find((m) => m.slug === slug) ?? null, [movies, slug]);

  // Aktif şehirdeki seanslar; o şehirde yoksa TÜM seanslar (şehir başlıklı gruplar).
  const sections = useMemo<{ city: string | null; list: NearbyShowtime[] }[]>(() => {
    if (!movie) return [];
    const c = city?.toLocaleLowerCase("tr") ?? null;
    const inCity = movie.showtimes.filter((s) => c && s.city.toLocaleLowerCase("tr") === c);
    if (inCity.length > 0) {
      return [{ city: city ?? null, list: sortByDistance(inCity.map((s) => withDistance(s, coords))) }];
    }
    // Aktif şehirde seans yok → tüm seansları şehir başlıklarıyla grupla.
    const byCity = new Map<string, NearbyShowtime[]>();
    for (const s of movie.showtimes) {
      const arr = byCity.get(s.city) ?? [];
      arr.push(withDistance(s, coords));
      byCity.set(s.city, arr);
    }
    return [...byCity.entries()].map(([cityName, list]) => ({
      city: cityName,
      list: sortByDistance(list),
    }));
  }, [movie, city, coords]);

  // Yükleniyor.
  if (movies === null) {
    return (
      <View style={[styles.root, { backgroundColor: T.bg }]}>
        <AuroraBackground />
      </View>
    );
  }

  // Bulunamadı.
  if (!movie) {
    return (
      <View style={[styles.root, { backgroundColor: T.bg }]}>
        <AuroraBackground />
        <View style={[styles.empty, { paddingTop: insets.top }]}>
          <Text style={{ fontSize: 56 }}>🎬</Text>
          <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: Space.md }]}>
            Film bulunamadı.
          </Text>
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            style={[styles.backTextBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          >
            <Text style={[Type.label, { color: T.text }]}>← Geri</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      >
        {/* HERO: backdrop (yoksa poster, o da olmazsa gradient placeholder) */}
        <View style={styles.hero}>
          <MoviePoster
            posterUrl={movie.backdropUrl ?? movie.posterUrl}
            backdropUrl={movie.backdropUrl ? movie.posterUrl : undefined}
            title={movie.title}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", "transparent", T.bg]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={10}
            accessibilityLabel="Geri"
            style={[styles.backBtn, { top: insets.top + 8, backgroundColor: T.scrim, borderColor: T.hairline }]}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>←</Text>
          </Pressable>
        </View>

        {/* Poster + başlık (hero'ya taşan) */}
        <View style={styles.headRow}>
          <View style={[styles.posterSmall, { borderColor: T.hairline }, glow(T.primary, 16, 0.3)]}>
            <MoviePoster
              posterUrl={movie.posterUrl}
              backdropUrl={movie.backdropUrl}
              title={movie.title}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.headInfo}>
            <Text style={[Type.h1, { color: T.text }]} numberOfLines={3}>{movie.title}</Text>
            {movie.originalTitle && movie.originalTitle !== movie.title ? (
              <Text style={[Type.label, { color: T.textFaint, marginTop: 4 }]} numberOfLines={1}>
                {movie.originalTitle}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={[Type.label, { color: T.gold }]}>⭐ {movie.rating.toFixed(1)}</Text>
              <Text style={[Type.label, { color: T.textDim }]}>{fmtDuration(movie.durationMin)}</Text>
              {movie.ageRating ? <Chip label={movie.ageRating} T={T} /> : null}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Türler */}
          {movie.genres.length > 0 && (
            <Animated.View entering={FadeInDown.duration(420).delay(40)} style={styles.chipWrap}>
              {movie.genres.map((g) => <Chip key={g} label={g} T={T} />)}
            </Animated.View>
          )}

          {/* FRAGMAN */}
          {movie.trailerUrl ? (
            <Animated.View entering={FadeInDown.duration(420).delay(80)}>
              <Pressable
                onPress={() => { tapH(); if (movie.trailerUrl) Linking.openURL(movie.trailerUrl).catch(() => {}); }}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={T.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.trailerBtn, glow(T.primary, 18, 0.4)]}
                >
                  <Text style={[Type.title, { color: "#fff" }]}>🎬 Fragmanı İzle</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Yönetmen */}
          {movie.director ? (
            <Animated.View entering={FadeInDown.duration(420).delay(120)} style={styles.section}>
              <Text style={[Type.label, { color: T.textFaint }]}>Yönetmen</Text>
              <Text style={[Type.body, { color: T.text, marginTop: 4 }]}>{movie.director}</Text>
            </Animated.View>
          ) : null}

          {/* Oyuncular */}
          {movie.cast.length > 0 && (
            <Animated.View entering={FadeInDown.duration(420).delay(160)} style={styles.section}>
              <Text style={[Type.label, { color: T.textFaint }]}>Oyuncular</Text>
              <View style={[styles.chipWrap, { marginTop: Space.sm }]}>
                {movie.cast.map((c) => <Chip key={c} label={c} T={T} />)}
              </View>
            </Animated.View>
          )}

          {/* Özet */}
          {movie.synopsis ? (
            <Animated.View entering={FadeInDown.duration(420).delay(200)} style={styles.section}>
              <Text style={[Type.label, { color: T.textFaint }]}>Özet</Text>
              <Text style={[Type.body, { color: T.textDim, marginTop: 4, lineHeight: 22 }]}>{movie.synopsis}</Text>
            </Animated.View>
          ) : null}

          {/* Seanslar */}
          <Animated.View entering={FadeInDown.duration(420).delay(240)} style={styles.section}>
            <Text style={[Type.h2, { color: T.text, marginBottom: Space.sm }]}>Seanslar</Text>
            {sections.length === 0 || sections.every((sec) => sec.list.length === 0) ? (
              <Text style={[Type.body, { color: T.textDim }]}>Şu an seans bilgisi yok.</Text>
            ) : (
              sections.map((sec, si) => (
                <View key={sec.city ?? `sec-${si}`} style={{ marginBottom: Space.md }}>
                  {sec.city ? (
                    <Text style={[Type.label, { color: T.textDim, marginBottom: Space.sm }]}>📍 {sec.city}</Text>
                  ) : null}
                  <View style={{ gap: Space.sm }}>
                    {sec.list.map((s, i) => <TheaterRow key={`${s.theater}-${i}`} s={s} T={T} />)}
                  </View>
                </View>
              ))
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const HERO_H = 280;

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Space.xl, gap: Space.sm },
  backTextBtn: { marginTop: Space.lg, paddingHorizontal: Space.lg, paddingVertical: Space.sm, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  hero: { height: HERO_H, width: "100%" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  headRow: { flexDirection: "row", gap: Space.md, paddingHorizontal: Space.lg, marginTop: -64 },
  posterSmall: {
    width: 96,
    height: 144,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
  },
  headInfo: { flex: 1, justifyContent: "flex-end", paddingBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Space.sm, marginTop: Space.sm },
  body: { paddingHorizontal: Space.lg, marginTop: Space.lg },
  section: { marginTop: Space.lg },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  trailerBtn: { marginTop: Space.lg, paddingVertical: Space.md, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  theaterRow: { padding: Space.sm, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  theaterHead: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  times: { flexDirection: "row", flexWrap: "wrap", gap: Space.xs, marginTop: Space.sm },
  timePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
});
