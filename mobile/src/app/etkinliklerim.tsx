import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type } from "@/theme/aurora";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH } from "@/lib/haptics";
import { useMyEvents, removeMyEvent, type MyEvent } from "@/lib/myEvents";
import { CATEGORIES } from "@/lib/categories";

function emojiFor(category: string | null): string {
  const hit = CATEGORIES.find((c) => c.key === category);
  return hit?.emoji ?? "🎟️";
}

function EventRow({
  e,
  T,
  delay,
  onEdit,
  onDelete,
}: {
  e: MyEvent;
  T: Palette;
  delay: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const place = [e.city, e.district].filter(Boolean).join(" · ");
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(delay)}>
      <Pressable
        onPress={() => { tapH(); onEdit(); }}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: T.surfaceStrong, borderColor: T.hairline },
          pressed && { opacity: 0.7 },
        ]}
      >
        {e.imageUri ? (
          <Image source={{ uri: e.imageUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: T.surface }]}>
            <Text style={{ fontSize: 26 }}>{emojiFor(e.category)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[Type.title, { color: T.text }]} numberOfLines={2}>{e.title}</Text>
          {place ? (
            <Text style={[Type.label, { color: T.textDim, marginTop: 4 }]} numberOfLines={1}>{place}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => { tapH(); onDelete(); }}
          hitSlop={10}
          style={[styles.delBtn, { backgroundColor: T.surface, borderColor: T.hairline }]}
        >
          <Text style={{ fontSize: 16 }}>🗑️</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function MyEventsScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { list, reload } = useMyEvents();

  const confirmDelete = (e: MyEvent) => {
    Alert.alert(e.title, t("delete") + "?", [
      { text: t("back"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await removeMyEvent(e.id);
          reload();
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 60, paddingHorizontal: 16, flexGrow: 1 }}
      >
        {/* Başlık + geri */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={10}
            accessibilityLabel={t("back")}
            style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>←</Text>
          </Pressable>
          <Text style={[Type.h1, { color: T.text }]}>{t("my_events")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>📭</Text>
            <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: Space.md }]}>
              {t("my_events_empty")}
            </Text>
            <Pressable
              onPress={() => { tapH(); router.replace("/olustur"); }}
              style={({ pressed }) => [
                styles.emptyBtn,
                { backgroundColor: T.primary },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[Type.title, { color: "#fff" }]}>{t("create_new_event")}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: Space.md, marginTop: Space.sm }}>
            {list.map((e, i) => (
              <EventRow
                key={e.id}
                e={e}
                T={T}
                delay={i * 50}
                onEdit={() => router.push({ pathname: "/olustur", params: { id: e.id } })}
                onDelete={() => confirmDelete(e)}
              />
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  delBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: Space.xxl, gap: Space.sm },
  emptyBtn: { marginTop: Space.lg, paddingVertical: 12, paddingHorizontal: 24, borderRadius: Radius.pill },
});
