import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { AuroraBackground } from "@/components/AuroraBackground";
import { fmtDay } from "@/lib/format";
import { imageFor, type ApiEvent } from "@/lib/api";
import { fetchPastEvents, type PastEvent } from "@/lib/pastEvents";

function open(e: ApiEvent) {
  tapH();
  router.push({ pathname: "/etkinlik/[id]", params: { id: e.id, data: JSON.stringify(e) } });
}

/** Tam genişlik "anı" kartı — biten etkinlik + paylaşılan içerik önizlemesi. */
function MemoryRow({ item, T, delay }: { item: PastEvent; T: Palette; delay: number }) {
  const { event, photoUris, shareCount, attendeeCount } = item;
  const [imgErr, setImgErr] = useState(false);
  const d = fmtDay(event.starts_at);
  const fallback = imageFor({ ...event, image_url: null });
  const previews = photoUris.slice(0, 5);

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)}>
      <Pressable
        onPress={() => open(event)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: T.bgElevated, borderColor: T.hairline },
          glow("#000", 12, 0.3),
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: imgErr ? fallback : imageFor(event) }}
            onError={() => setImgErr(true)}
            style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
            contentFit="cover"
            transition={250}
          />
          {/* Sıcak/sepia anı vuali. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(120,80,30,0.2)" }]} />
          <LinearGradient
            colors={["transparent", "transparent", T.scrim]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={[styles.pastBadge, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={[Type.micro, { color: T.text }]}>⏳ GEÇTİ</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={[Type.h2, { color: "#fff" }]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={[Type.label, { color: "rgba(255,255,255,0.85)", marginTop: 3 }]} numberOfLines={1}>
              {d.day} {d.month} · {event.city || "Türkiye"}
            </Text>
          </View>
        </View>

        {/* Paylaşımlar bölümü — yalnız içerik varsa render. */}
        {previews.length > 0 || shareCount > 0 || attendeeCount > 0 ? (
          <View style={styles.shareRow}>
            {previews.length > 0 ? (
              <View style={styles.thumbStrip}>
                {previews.map((uri, i) => (
                  <Image
                    key={`${uri}-${i}`}
                    source={{ uri }}
                    style={[styles.thumb, { borderColor: T.bgElevated }]}
                    contentFit="cover"
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.statsCol}>
              {shareCount > 0 ? (
                <Text style={[Type.label, { color: T.primary }]}>📸 {shareCount} paylaşım</Text>
              ) : null}
              {attendeeCount > 0 ? (
                <Text style={[Type.label, { color: T.textDim }]}>👥 {attendeeCount} katılımcı</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Tüm biten etkinlikler — tam ekran, animasyonlu liste + paylaşım önizlemeleri. */
export default function GecmisScreen() {
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PastEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPastEvents({ city: city ?? undefined, limit: 30 })
      .then((list) => {
        if (alive) {
          setItems(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [city]);

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => { tapH(); router.back(); }}
          hitSlop={10}
          style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
        >
          <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>←</Text>
        </Pressable>
        <Text style={[Type.h1, { color: T.text }]}>Biten Etkinlikler</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🗓️</Text>
          <Text style={[Type.body, { color: T.textDim, textAlign: "center" }]}>
            {city ? `${city} için biten etkinlik bulunamadı.` : "Henüz biten etkinlik yok."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.event.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + 40, gap: Space.lg }}
          renderItem={({ item, index }) => (
            <MemoryRow item={item} T={T} delay={Math.min(index, 10) * 50} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Space.xl },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  heroWrap: { height: 190, justifyContent: "flex-end" },
  pastBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroBottom: { padding: Space.lg },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    gap: Space.md,
  },
  thumbStrip: { flexDirection: "row", flexShrink: 1 },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: -8,
  },
  statsCol: { alignItems: "flex-end", gap: 3 },
});
