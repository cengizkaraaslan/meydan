import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { fetchPlaces, cachePlace, placeImageFor, type ApiPlace } from "@/lib/api";
import { useUserCoords, placeDistanceKm, placeDistanceLabel } from "@/lib/geo";

const CARD_W = 160;
const CARD_H = 116;

const feeShort = (fee?: string | null) => (fee === "PAID" ? "💳 Ücretli" : fee === "FREE" ? "🆓 Ücretsiz" : "❔ Bilinmiyor");

function PlaceMiniCard({ p, T, index, dist }: { p: ApiPlace; T: Palette; index: number; dist: string | null }) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(index * 70)}>
      <Pressable
        onPress={() => { tapH(); const key = cachePlace(p) || p.slug; router.push({ pathname: "/yer/[id]", params: { id: key } } as never); }}
        style={({ pressed }) => [{ width: CARD_W }, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.poster, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }, glow(T.primary, 14, 0.25)]}>
          <Image source={{ uri: placeImageFor(p) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          {dist ? (
            <View style={styles.distBadge}>
              <Text style={styles.distTxt}>📏 {dist}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[Type.label, { color: T.text, marginTop: Space.sm }]} numberOfLines={1}>{p.name}</Text>
        <Text style={[Type.micro, { color: T.textFaint, marginTop: 2 }]} numberOfLines={1}>
          📍 {p.city} · {feeShort(p.fee)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function PlacesSection() {
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const user = useUserCoords();
  const [places, setPlaces] = useState<ApiPlace[]>([]);
  // Yakından uzağa sırala: koordinatı + konum olanlar km'ye göre; koordinatsızlar sona.
  const sorted = useMemo(() => {
    return [...places].sort((a, b) => {
      const da = placeDistanceKm(a, user);
      const db = placeDistanceKm(b, user);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [places, user]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Önce şehir, yetersizse ülke geneli — anasayfa hep dolu görünsün.
      let list: ApiPlace[] = [];
      try {
        const r = await fetchPlaces({ city: city ?? undefined, pageSize: 10 });
        list = r.data;
        if (list.length < 4) {
          const r2 = await fetchPlaces({ pageSize: 10 });
          const seen = new Set(list.map((p) => p.id));
          list = [...list, ...r2.data.filter((p) => !seen.has(p.id))].slice(0, 10);
        }
      } catch {
        /* yok say */
      }
      if (alive) setPlaces(list);
    })();
    return () => { alive = false; };
  }, [city]);

  if (places.length === 0) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[Type.h2, { color: T.text }]}>🏛️ Gezilecek Yerler</Text>
        <Pressable onPress={() => { tapH(); router.push("/yerler" as never); }} hitSlop={8}>
          <Text style={[Type.label, { color: T.primary }]}>Tümü →</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {sorted.map((p, i) => (
          <PlaceMiniCard key={p.id} p={p} T={T} index={i} dist={placeDistanceLabel(p, user)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: Space.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Space.lg, marginBottom: Space.md },
  list: { paddingHorizontal: Space.lg, gap: Space.md },
  poster: { width: CARD_W, height: CARD_H, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, overflow: "hidden" },
  distBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  distTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
