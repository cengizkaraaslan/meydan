import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Radius, Type, glow } from "../theme/aurora";
import { useTheme } from "../lib/theme";
import { cachePlace, placeImageFor, type ApiPlace } from "../lib/api";
import { useUserCoords, placeDistanceLabel } from "../lib/geo";
import { Badge } from "../ui/atoms";

const TYPE_LABEL: Record<string, string> = {
  MUZE: "Müze",
  OREN_YERI: "Örenyeri",
  SARAY: "Saray & Köşk",
  DIGER: "Gezilecek Yer",
};

/** Ücret etiketi: ücretliyse "Ücretli", ücretsizse "Ücretsiz", bilinmiyorsa "Bilinmiyor". */
function feeLabel(fee?: string | null): string {
  return fee === "PAID" ? "💳 Ücretli" : fee === "FREE" ? "🆓 Ücretsiz" : "❔ Bilinmiyor";
}
function feeColor(fee: string | null | undefined, T: ReturnType<typeof useTheme>["t"]): string {
  return fee === "PAID" ? T.gold : fee === "FREE" ? T.success : T.textFaint;
}

function open(p: ApiPlace) {
  Haptics.selectionAsync();
  const key = cachePlace(p) || p.slug;
  router.push({ pathname: "/yer/[id]", params: { id: key } } as never);
}

function hoursOf(p: ApiPlace): string | null {
  return p.open_time && p.close_time ? `${p.open_time}–${p.close_time}` : p.open_time ?? null;
}

/** Büyük öne çıkan kart (anasayfa carousel). */
export function PlaceHeroCard({ place, width }: { place: ApiPlace; width: number }) {
  const { t: T } = useTheme();
  const GRAD = T.primaryGradient;
  const [imgErr, setImgErr] = useState(false);
  const hours = hoursOf(place);
  const dist = placeDistanceLabel(place, useUserCoords());
  return (
    <Pressable onPress={() => open(place)} style={[{ width }, glow(GRAD[0], 24, 0.5)]}>
      <View style={[styles.hero, { borderRadius: Radius.xl }]}>
        <Image
          source={{ uri: imgErr ? placeImageFor({ ...place, image_url: null }) : placeImageFor(place) }}
          onError={() => setImgErr(true)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient colors={["transparent", "rgba(8,7,13,0.55)", "rgba(8,7,13,0.97)"]} locations={[0, 0.4, 0.82]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroTop}>
          <Badge text={TYPE_LABEL[place.type] ?? "Gezilecek Yer"} color={GRAD[0]} />
        </View>
        <View style={styles.heroBottom}>
          <Text style={[Type.hero, { color: "#fff" }]} numberOfLines={2}>{place.name}</Text>
          <View style={styles.metaRow}>
            <Text style={[Type.body, { color: GRAD[0], fontWeight: "800" }]}>📍 {place.city}</Text>
            {dist ? (
              <>
                <View style={[styles.dot, { backgroundColor: T.textFaint }]} />
                <Text style={[Type.body, { color: "#fff", fontWeight: "700" }]}>📏 {dist}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={[Type.body, { color: feeColor(place.fee, T), fontWeight: "700" }]}>{feeLabel(place.fee)}</Text>
            {hours ? (
              <>
                <View style={[styles.dot, { backgroundColor: T.textFaint }]} />
                <Text style={[Type.body, { color: T.textDim }]}>🕘 {hours}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Liste satır kartı. */
export function PlaceRow({ place }: { place: ApiPlace }) {
  const { t: T } = useTheme();
  const GRAD = T.primaryGradient;
  const [imgErr, setImgErr] = useState(false);
  const hours = hoursOf(place);
  const dist = placeDistanceLabel(place, useUserCoords());
  return (
    <Pressable onPress={() => open(place)} style={[styles.row, { backgroundColor: T.surface }]}>
      <View style={styles.rowImgWrap}>
        <Image
          source={{ uri: imgErr ? placeImageFor({ ...place, image_url: null }) : placeImageFor(place) }}
          onError={() => setImgErr(true)}
          style={styles.rowImg}
          contentFit="cover"
          transition={200}
        />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[Type.title, { color: T.text }]} numberOfLines={2}>{place.name}</Text>
        <Text style={[Type.label, { color: T.textFaint }]} numberOfLines={1}>
          📍 {place.district ? `${place.district} · ${place.city}` : place.city}
          {dist ? `  ·  📏 ${dist}` : ""}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[Type.label, { color: GRAD[0] }]}>{TYPE_LABEL[place.type] ?? "Gezilecek Yer"}</Text>
          <View style={[styles.dot, { backgroundColor: T.textFaint }]} />
          <Text style={[Type.label, { color: feeColor(place.fee, T) }]}>{feeLabel(place.fee)}</Text>
          {hours ? (
            <>
              <View style={[styles.dot, { backgroundColor: T.textFaint }]} />
              <Text style={[Type.label, { color: T.textDim }]}>🕘 {hours}</Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, overflow: "hidden", justifyContent: "space-between" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  heroBottom: { padding: 18, gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", padding: 10, borderRadius: Radius.lg },
  rowImgWrap: { width: 78, height: 78, borderRadius: Radius.md, overflow: "hidden" },
  rowImg: { width: "100%", height: "100%" },
});
