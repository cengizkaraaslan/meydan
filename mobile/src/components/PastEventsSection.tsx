import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { tapH } from "@/lib/haptics";
import { SectionHeader } from "@/ui/atoms";
import { fmtDay } from "@/lib/format";
import { imageFor, type ApiEvent } from "@/lib/api";
import { fetchPastEvents, type PastEvent } from "@/lib/pastEvents";

const CARD_W = 220;

function open(e: ApiEvent) {
  tapH();
  router.push({ pathname: "/etkinlik/[id]", params: { id: e.id, data: JSON.stringify(e) } });
}

/**
 * "Anı/polaroid" kartı — normal EventCard'dan kasıtlı olarak FARKLI:
 *  - beyaz polaroid çerçeve + alt geniş kenar (anı defteri hissi)
 *  - görsel sepia/soluk (opacity + warm overlay)
 *  - "GEÇTİ" rozeti
 *  - VARSA: paylaşılan foto küçük resimleri + "N paylaşım" / katılımcı (yalnız N>0)
 */
function PolaroidCard({ item, T, delay }: { item: PastEvent; T: Palette; delay: number }) {
  const { event, photoUris, shareCount, attendeeCount } = item;
  const [imgErr, setImgErr] = useState(false);
  const d = fmtDay(event.starts_at);
  const fallback = imageFor({ ...event, image_url: null });
  const previews = photoUris.slice(0, 3);

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)}>
      <Pressable
        onPress={() => open(event)}
        style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
      >
        {/* Polaroid çerçeve: hafif eğik dış gölge, krem zemin. */}
        <View style={[styles.frame, { backgroundColor: T.bgElevated, borderColor: T.hairline }, glow("#000", 14, 0.35)]}>
          <View style={styles.photoWrap}>
            <Image
              source={{ uri: imgErr ? fallback : imageFor(event) }}
              onError={() => setImgErr(true)}
              style={[StyleSheet.absoluteFill, styles.photo]}
              contentFit="cover"
              transition={250}
            />
            {/* Warm/sepia vual — anı hissi (siyah değil; sıcak amber). */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(120,80,30,0.22)" }]} />
            <LinearGradient
              colors={["transparent", T.scrim]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            {/* GEÇTİ rozeti */}
            <View style={[styles.pastBadge, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={[Type.micro, { color: T.text }]}>⏳ GEÇTİ</Text>
            </View>
            {/* Paylaşılan foto önizleme küçük resimleri — yalnız varsa. */}
            {previews.length > 0 ? (
              <View style={styles.thumbRow}>
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
          </View>

          {/* Polaroid alt yazısı (geniş beyaz kenar bölgesi). */}
          <View style={styles.caption}>
            <Text style={[Type.title, { color: T.text }]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={[Type.micro, { color: T.textFaint, marginTop: 2 }]} numberOfLines={1}>
              {d.day} {d.month} · {event.city || "Türkiye"}
            </Text>

            {/* Paylaşım/katılım — yalnız >0 olanlar gösterilir (0 ise hiç yok). */}
            {shareCount > 0 || attendeeCount > 0 ? (
              <View style={styles.statsRow}>
                {shareCount > 0 ? (
                  <Text style={[Type.label, { color: T.primary }]}>📸 {shareCount} paylaşım</Text>
                ) : null}
                {attendeeCount > 0 ? (
                  <Text style={[Type.label, { color: T.textDim }]}>👥 {attendeeCount}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Anasayfa "Biten Etkinlikler" bölümü — tarihi geçmiş etkinlikleri aktif şehre göre
 * "anı/polaroid" tarzı yatay şeritte gösterir. Paylaşılan içerik (foto/yorum) varsa
 * önizleme + sayı görünür; yoksa rakam hiç yazılmaz. Hiç geçmiş etkinlik yoksa null.
 */
export function PastEventsSection() {
  const { t: T } = useTheme();
  const { city } = useActiveCity();
  const [items, setItems] = useState<PastEvent[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    fetchPastEvents({ city: city ?? undefined, limit: 12 })
      .then((list) => {
        if (alive) {
          setItems(list);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [city]);

  // Veri gelmeden veya hiç geçmiş etkinlik yoksa hiç render etme.
  if (!ready || items.length === 0) return null;

  return (
    <View style={{ marginBottom: Space.xl }}>
      <SectionHeader
        title="Biten Etkinlikler"
        accent={T.gold}
        action={
          <Pressable onPress={() => { tapH(); router.push("/gecmis"); }} hitSlop={8}>
            <Text style={[Type.label, { color: T.primary }]}>Tümü →</Text>
          </Pressable>
        }
      />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(it) => it.event.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Space.md, paddingRight: Space.md }}
        renderItem={({ item, index }) => (
          <PolaroidCard item={item} T={T} delay={Math.min(index, 8) * 60} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: CARD_W,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    paddingBottom: 12,
    // Hafif eğiklik — gerçek polaroid hissi.
    transform: [{ rotate: "-1.2deg" }],
  },
  photoWrap: {
    height: 150,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  photo: {
    // Soluk/anı: tam doygunluk yerine hafif kısık.
    opacity: 0.92,
  },
  pastBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  thumbRow: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    marginLeft: -8,
  },
  caption: {
    paddingTop: 10,
    paddingHorizontal: 4,
    gap: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
});
