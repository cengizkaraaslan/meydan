import React, { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type } from "@/theme/aurora";
import { EventRow } from "@/components/EventCard";
import { Loader, EmptyState, Pill } from "@/ui/atoms";
import { CATEGORIES } from "@/lib/categories";
import { fetchEvents, type ApiEvent } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH } from "@/lib/haptics";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [results, setResults] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q && !cat) {
      setResults([]);
      setTouched(false);
      return;
    }
    setLoading(true);
    setTouched(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetchEvents({ search: q || undefined, category: cat ?? undefined, pageSize: 40 });
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, cat]);

  return (
    <View style={{ flex: 1 }}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,7,13,0.78)" }]} />

      <View style={{ flex: 1, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        {/* Arama çubuğu */}
        <View style={[styles.searchBar, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
          <Text style={{ fontSize: 17 }}>🔍</Text>
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={t("search")}
            placeholderTextColor={T.textFaint}
            style={[Type.body, { flex: 1, color: T.text }]}
            returnKeyType="search"
          />
          <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10}>
            <Text style={[Type.title, { color: T.primary }]}>{t("cancel")}</Text>
          </Pressable>
        </View>

        {/* Kategori filtreleri */}
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 14 }}
          renderItem={({ item }) => (
            <Pill label={`${item.emoji} ${item.label}`} active={cat === item.key} gradient={item.gradient} onPress={() => setCat(cat === item.key ? null : item.key)} />
          )}
        />

        {loading ? (
          <Loader />
        ) : !touched ? (
          <EmptyState emoji="🔮" title={t("search_title")} sub={t("search_hint")} />
        ) : results.length === 0 ? (
          <EmptyState emoji="🌌" title={t("search_empty")} sub={t("search_empty_sub")} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(e) => e.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<Text style={[Type.label, { color: T.textFaint, marginBottom: 8 }]}>{results.length} {t("results")}</Text>}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.duration(400).delay(Math.min(index, 8) * 60)}>
                <EventRow event={item} />
              </Animated.View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
