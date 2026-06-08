import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Location from "expo-location";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { fetchMovies, haversineKm, type Movie, type Showtime } from "@/lib/cinema";

interface NearbyShowtime extends Showtime {
  distanceKm: number | null;
}

function PosterThumb({ uri, T }: { uri: string; T: Palette }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: T.surface, borderColor: T.hairline }]}>
        <Text style={{ fontSize: 30 }}>🎬</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.poster, { borderColor: T.hairline }]}
      contentFit="cover"
      transition={200}
      onError={() => setErr(true)}
    />
  );
}

function MovieBlock({
  m,
  city,
  coords,
  T,
  delay,
}: {
  m: Movie;
  city: string | null;
  coords: { lat: number; lng: number } | null;
  T: Palette;
  delay: number;
}) {
  // O şehirdeki sinemalar + mesafe; mesafeye göre artan sırala.
  const theaters = useMemo<NearbyShowtime[]>(() => {
    const c = city?.toLocaleLowerCase("tr") ?? null;
    const list = m.showtimes
      .filter((s) => !c || s.city.toLocaleLowerCase("tr") === c)
      .map<NearbyShowtime>((s) => ({
        ...s,
        distanceKm:
          coords && s.lat != null && s.lng != null
            ? haversineKm(coords.lat, coords.lng, s.lat, s.lng)
            : null,
      }));
    list.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    return list;
  }, [m.showtimes, city, coords]);

  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(delay)}
      style={[styles.block, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
    >
      <View style={styles.blockHead}>
        <PosterThumb uri={m.posterUrl} T={T} />
        <View style={{ flex: 1 }}>
          <Text style={[Type.title, { color: T.text }]} numberOfLines={2}>{m.title}</Text>
          <Text style={[Type.micro, { color: T.gold, marginTop: 4 }]}>⭐ {m.rating.toFixed(1)}</Text>
          <Text style={[Type.label, { color: T.textDim, marginTop: 4 }]} numberOfLines={1}>
            {m.genres.slice(0, 3).join(" · ")}
          </Text>
          <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>{m.durationMin} dk · {m.ageRating}</Text>
        </View>
      </View>

      {theaters.length > 0 && (
        <View style={{ marginTop: Space.md, gap: Space.sm }}>
          {theaters.map((s, i) => (
            <View
              key={`${s.theater}-${i}`}
              style={[styles.theaterRow, { backgroundColor: T.surface, borderColor: T.hairline }]}
            >
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
          ))}
        </View>
      )}
    </Animated.View>
  );
}

export default function VizyonScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMovies(city ?? undefined).then((list) => {
      if (alive) setMovies(list);
    });
    return () => {
      alive = false;
    };
  }, [city]);

  // Kullanıcı konumu (izin varsa) — mesafe hesabı için. İzin yoksa km gösterme.
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

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 60,
          paddingHorizontal: 16,
          flexGrow: 1,
        }}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={10}
            accessibilityLabel="Geri"
            style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>←</Text>
          </Pressable>
          <Text style={[Type.h1, { color: T.text }]}>Vizyondaki Filmler</Text>
          <View style={{ width: 40 }} />
        </View>

        {city ? (
          <Text style={[Type.label, { color: T.textDim, marginBottom: Space.md }]}>📍 {city}</Text>
        ) : null}

        {movies.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>🍿</Text>
            <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: Space.md }]}>
              Şu an gösterilecek film bulunamadı.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Space.md }}>
            {movies.map((m, i) => (
              <MovieBlock key={m.id} m={m} city={city} coords={coords} T={T} delay={i * 60} />
            ))}
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
  block: { padding: Space.md, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  blockHead: { flexDirection: "row", gap: Space.md },
  poster: { width: 84, height: 126, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  theaterRow: { padding: Space.sm, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  theaterHead: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  times: { flexDirection: "row", flexWrap: "wrap", gap: Space.xs, marginTop: Space.sm },
  timePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: Space.xxl, gap: Space.sm },
});
