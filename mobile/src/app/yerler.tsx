import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { fetchPlaces, type ApiPlace } from "@/lib/api";
import { PlaceRow } from "@/components/PlaceCard";
import { tapH } from "@/lib/haptics";

const TYPES: { key: string; label: string }[] = [
  { key: "", label: "Tümü" },
  { key: "MUZE", label: "Müze" },
  { key: "OREN_YERI", label: "Örenyeri" },
  { key: "SARAY", label: "Saray" },
];

const PAGE = 20;

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();

  const [items, setItems] = useState<ApiPlace[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const reqId = useRef(0);

  const load = useCallback(async (p: number, q: { type: string; search: string }) => {
    const my = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetchPlaces({ type: q.type || undefined, search: q.search || undefined, page: p, pageSize: PAGE });
      if (my !== reqId.current) return; // eski istek
      setTotalPages(res.meta.total_pages);
      setItems((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setPage(p);
    } catch {
      /* yok say */
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, []);

  // Filtre değişince ilk sayfayı yeniden yükle (debounce arama).
  useEffect(() => {
    const tm = setTimeout(() => { void load(1, { type, search }); }, search ? 350 : 0);
    return () => clearTimeout(tm);
  }, [type, search, load]);

  const loadMore = () => {
    if (loading || page >= totalPages) return;
    void load(page + 1, { type, search });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderColor: T.hairline }]}>
        <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10} style={[styles.backBtn, { borderColor: T.hairline }]}>
          <Ionicons name="chevron-back" size={20} color={T.text} />
        </Pressable>
        <Text style={[Type.h2, { color: T.text, flex: 1 }]}>🏛️ Gezilecek Yerler</Text>
      </View>

      {/* Arama */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <View style={[styles.searchWrap, { backgroundColor: T.surface, borderColor: T.hairline }]}>
          <Ionicons name="search" size={16} color={T.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Müze veya şehir ara…"
            placeholderTextColor={T.textFaint}
            style={[styles.searchInput, { color: T.text }]}
          />
        </View>
      </View>

      {/* Tür çipleri */}
      <View style={{ paddingTop: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {TYPES.map((tp) => {
            const active = type === tp.key;
            return (
              <Pressable
                key={tp.key || "all"}
                onPress={() => { tapH(); setType(tp.key); }}
                style={[styles.chip, { backgroundColor: active ? T.primary : T.surface, borderColor: active ? T.primary : T.hairline }]}
              >
                <Text style={[Type.label, { color: active ? "#fff" : T.textDim }]}>{tp.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlaceRow place={item} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
              <Text style={{ fontSize: 44 }}>🏛️</Text>
              <Text style={[Type.body, { color: T.textFaint }]}>Sonuç bulunamadı</Text>
            </View>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator color={T.primary} style={{ marginTop: 16 }} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
});
