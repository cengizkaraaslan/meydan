import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Radius, Type, glow } from "../theme/aurora";
import { useTheme } from "../lib/theme";
import { useAuth } from "@/lib/auth";
import { useT } from "../lib/i18n";
import { catMeta } from "../lib/categories";
import { fmtDay, priceLabel, isUniversitySource, relativeDayLabel } from "../lib/format";
import { cacheEvent, imageFor, type ApiEvent } from "../lib/api";
import { useUserCoords, approxDistanceLabel } from "../lib/geo";
import { toggleFavorite, useFavorites } from "../lib/favorites";
import { Badge } from "../ui/atoms";
import { showAuthPrompt } from "../lib/authPrompt";

function Heart({ event }: { event: ApiEvent }) {
  const { ids } = useFavorites();
  const { user } = useAuth();
  const { t } = useT();
  const [on, setOn] = useState(false);
  useEffect(() => setOn(ids.has(event.id)), [ids, event.id]);
  return (
    <Pressable
      hitSlop={10}
      onPress={async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // #10/#17: Favoriler gerçek kullanıcıya özel. user yoksa global giriş prompt'u (per-kart Modal YOK).
        if (!user) {
          showAuthPrompt(t("lock_fav_title"));
          return;
        }
        setOn(await toggleFavorite(event));
      }}
      style={styles.heart}
    >
      <Text style={{ fontSize: 16 }}>{on ? "❤️" : "🤍"}</Text>
    </Pressable>
  );
}

function open(e: ApiEvent) {
  Haptics.selectionAsync();
  // Etkinliği belleğe al, yalnız id/slug ile yönlendir (ağır JSON parametresi yok →
  // uzun açıklamalı/boş-id'li etkinlikler de açılır).
  const key = cacheEvent(e) || "event";
  router.push({ pathname: "/etkinlik/[id]", params: { id: key } });
}

/** Büyük öne çıkan kart (carousel). */
export function HeroCard({ event, width }: { event: ApiEvent; width: number }) {
  const { t: T } = useTheme();
  const c = catMeta(event.category);
  const d = fmtDay(event.starts_at);
  const coords = useUserCoords();
  const dist = approxDistanceLabel(event, coords);
  // #8/#15: Görsel yüklenemezse kategori fallback'ine düş.
  const [imgErr, setImgErr] = useState(false);
  const categoryFallback = imageFor({ ...event, image_url: null });
  return (
    <Pressable onPress={() => open(event)} style={[{ width }, glow(c.gradient[0], 24, 0.5)]}>
      <View style={[styles.hero, { borderRadius: Radius.xl }]}>
        <Image
          source={{ uri: imgErr ? categoryFallback : imageFor(event) }}
          onError={() => setImgErr(true)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient colors={["transparent", "rgba(8,7,13,0.55)", "rgba(8,7,13,0.97)"]} locations={[0, 0.4, 0.82]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <Badge text={c.label} color={c.gradient[0]} />
          <Heart event={event} />
        </View>
        <View style={styles.heroBottom}>
          <Text style={[Type.hero, { color: "#fff" }]} numberOfLines={2}>
            {event.title}
          </Text>
          <View style={styles.metaRow}>
            {(() => {
              const rel = relativeDayLabel(event.starts_at);
              return rel ? (
                <Text style={[Type.body, { color: c.gradient[0], fontWeight: "800" }]}>
                  {rel} · {event.city || "Türkiye"}
                </Text>
              ) : (
                <Text style={[Type.body, { color: T.textDim }]}>
                  {d.day} {d.month} · {event.city || "Türkiye"}
                </Text>
              );
            })()}
            <View style={[styles.dot, { backgroundColor: T.textFaint }]} />
            <Text style={[Type.body, { color: isUniversitySource(event.source) ? T.cyan : event.is_free ? T.success : T.gold }]}>{priceLabel(event)}</Text>
            {dist ? (
              <>
                <View style={[styles.dot, { backgroundColor: T.textFaint }]} />
                <Text style={[Type.body, { color: T.textDim }]}>📍 {dist}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Liste satır kartı. */
export function EventRow({ event }: { event: ApiEvent }) {
  const { t: T } = useTheme();
  const c = catMeta(event.category);
  const d = fmtDay(event.starts_at);
  const coords = useUserCoords();
  const dist = approxDistanceLabel(event, coords);
  // #8/#15: Görsel yüklenemezse kategori fallback'ine düş.
  const [imgErr, setImgErr] = useState(false);
  const categoryFallback = imageFor({ ...event, image_url: null });
  return (
    <Pressable onPress={() => open(event)} style={[styles.row, { backgroundColor: T.surface }]}>
      <View style={styles.rowImgWrap}>
        <Image
          source={{ uri: imgErr ? categoryFallback : imageFor(event) }}
          onError={() => setImgErr(true)}
          style={styles.rowImg}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient colors={c.gradient} style={styles.dateBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={[Type.h2, { color: "#fff", lineHeight: 22 }]}>{d.day}</Text>
          <Text style={[Type.micro, { color: "rgba(255,255,255,0.9)" }]}>{d.month}</Text>
        </LinearGradient>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[Type.title, { color: T.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={[Type.label, { color: T.textFaint }]} numberOfLines={1}>
          📍 {event.venue || event.city || "Türkiye"}{dist ? `  ·  ${dist}` : ""}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[Type.label, { color: c.gradient[0] }]}>{c.emoji} {c.label}</Text>
          <View style={[styles.dot, { backgroundColor: T.textFaint }]} />
          <Text style={[Type.label, { color: isUniversitySource(event.source) ? T.cyan : event.is_free ? T.success : T.gold }]}>{priceLabel(event)}</Text>
        </View>
      </View>
      <Heart event={event} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { height: 360, overflow: "hidden", justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  heroBottom: { padding: 18, gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  heart: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row", gap: 12, alignItems: "center", padding: 10,
    borderRadius: Radius.lg,
  },
  rowImgWrap: { width: 78, height: 78, borderRadius: Radius.md, overflow: "hidden" },
  rowImg: { width: "100%", height: "100%" },
  dateBadge: { position: "absolute", left: 6, top: 6, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", minWidth: 40 },
});
