import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type } from "@/theme/aurora";
import { AuroraBackground } from "@/components/AuroraBackground";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH } from "@/lib/haptics";
import { listConversations, type Conversation } from "@/lib/conversations";

/**
 * Instagram-Direct tarzı tam ekran mesaj kutusu.
 * Sohbet balonuna (ChatBubble FAB) basınca açılır. Yüklenirken shimmer skeleton,
 * boşsa boş durum, dolduğunda arama + pull-to-refresh'li konuşma listesi gösterir.
 */
export default function MesajlarScreen() {
  const { t: T } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const hasLoaded = useRef(false);

  const load = useCallback(async (background: boolean) => {
    if (!background) setLoading(true);
    try {
      const list = await listConversations();
      setConvos(list);
    } catch {
      /* sessiz geç — boş/empty durum gösterilir */
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  // İlk açılışta skeleton'lı yükle; sonraki odaklanmalarda (sohbetten dönünce) arkaplanda tazele.
  useFocusEffect(
    useCallback(() => {
      load(hasLoaded.current);
      hasLoaded.current = true;
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return convos;
    return convos.filter((c) => c.name.toLocaleLowerCase("tr").includes(needle));
  }, [convos, q]);

  const openChat = useCallback((id: string) => {
    tapH();
    router.push(`/sohbet/${id}`);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />

      {/* Header — Instagram Direct tarzı */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.hairline }]}>
        <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10} style={[styles.iconBtn, { backgroundColor: T.surfaceStrong }]}>
          <Text style={{ color: T.text, fontSize: 22, lineHeight: 24 }}>‹</Text>
        </Pressable>
        <Text style={[Type.h2, { color: T.text, flex: 1 }]} numberOfLines={1}>
          {t("chats_title")}
        </Text>
        <View style={[styles.iconBtn, { backgroundColor: T.surfaceStrong }]}>
          <Ionicons name="create-outline" size={20} color={T.text} />
        </View>
      </View>

      {/* Arama kutusu */}
      <View style={[styles.searchWrap, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
        <Ionicons name="search" size={17} color={T.textFaint} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("search") ?? "Ara"}
          placeholderTextColor={T.textFaint}
          style={[Type.body, { color: T.text, flex: 1, padding: 0 }]}
          returnKeyType="search"
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ("")} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={T.textFaint} />
          </Pressable>
        )}
      </View>

      {/* Gövde: yüklenirken skeleton, boşsa boş durum, doluysa liste */}
      {loading && convos.length === 0 ? (
        <View style={{ paddingTop: 6 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonRow key={i} T={T} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} colors={[T.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 44, marginBottom: 10 }}>💬</Text>
              <Text style={[Type.body, { color: T.textDim, textAlign: "center", lineHeight: 21 }]}>
                {q ? "Sonuç yok" : t("no_chats")}
              </Text>
            </View>
          }
          renderItem={({ item }) => <ConvoRow T={T} c={item} onPress={() => openChat(item.id)} />}
        />
      )}
    </View>
  );
}

function ConvoRow({ T, c, onPress }: { T: Palette; c: Conversation; onPress: () => void }) {
  const unread = c.unread > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View>
        <Image source={{ uri: c.avatar }} style={styles.avatar} contentFit="cover" transition={150} />
        {c.online && <View style={[styles.onlineDot, { backgroundColor: T.success, borderColor: T.bg }]} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Type.title, { color: T.text, fontWeight: unread ? "800" : "600" }]} numberOfLines={1}>
          {c.name}
        </Text>
        <Text
          style={[Type.label, { color: unread ? T.text : T.textDim, marginTop: 2, fontWeight: unread ? "700" : "400" }]}
          numberOfLines={1}
        >
          {c.lastText ?? "Yeni eşleşme — selam ver 👋"}
        </Text>
      </View>
      {unread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{c.unread > 99 ? "99+" : c.unread}</Text>
        </View>
      ) : (
        <Text style={{ color: T.textFaint, fontSize: 20 }}>›</Text>
      )}
    </Pressable>
  );
}

/** Yüklenme iskeleti — nabız gibi parlayan satır (Instagram'ın shimmer'ı gibi). */
function SkeletonRow({ T }: { T: Palette }) {
  const o = useSharedValue(0.4);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  const block = { backgroundColor: T.surfaceStrong } as const;
  return (
    <View style={styles.row}>
      <Animated.View style={[styles.avatar, block, st]} />
      <View style={{ flex: 1, gap: 8 }}>
        <Animated.View style={[{ height: 13, width: "45%", borderRadius: 6 }, block, st]} />
        <Animated.View style={[{ height: 11, width: "72%", borderRadius: 6 }, block, st]} />
      </View>
    </View>
  );
}

const AV = 56;
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(8,7,13,0.5)",
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: { width: AV, height: AV, borderRadius: AV / 2 },
  onlineDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 90, paddingHorizontal: 40 },
});
