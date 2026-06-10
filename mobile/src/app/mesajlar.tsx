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
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { AuroraBackground } from "@/components/AuroraBackground";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { showAuthPrompt } from "@/lib/authPrompt";
import { tapH } from "@/lib/haptics";
import { listConversations, type Conversation } from "@/lib/conversations";
import { useIsAdmin } from "@/lib/admin";
import { searchMentionUsers, type MentionUser } from "@/lib/mentions";

/**
 * Instagram-Direct tarzı tam ekran mesaj kutusu.
 * Sohbet balonuna (ChatBubble FAB) basınca açılır. Yüklenirken shimmer skeleton,
 * boşsa boş durum, dolduğunda arama + pull-to-refresh'li konuşma listesi gösterir.
 */
export default function MesajlarScreen() {
  const { t: T } = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);

  // Admin-only: tüm kullanıcılarda @ad/e-posta ile arama → sohbet aç. Büyüteçle açılır/kapanır.
  const { admin } = useIsAdmin();
  const [showFind, setShowFind] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [findResults, setFindResults] = useState<MentionUser[]>([]);
  const findTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onFindChange = useCallback((txt: string) => {
    setFindQ(txt);
    const query = txt.replace(/^@/, "").trim();
    if (findTimer.current) clearTimeout(findTimer.current);
    if (!query) { setFindResults([]); return; }
    findTimer.current = setTimeout(async () => {
      setFindResults(await searchMentionUsers(query));
    }, 180);
  }, []);

  const openWithUser = useCallback((u: MentionUser) => {
    tapH();
    setFindQ("");
    setFindResults([]);
    router.push({ pathname: "/sohbet/[id]", params: { id: u.id || u.email, name: u.name ?? "", avatar: u.avatar ?? "" } });
  }, []);

  const load = useCallback(async (background: boolean) => {
    if (!user) { setLoading(false); return; }
    if (!background) setLoading(true);
    try {
      const list = await listConversations();
      setConvos(list);
    } catch {
      /* sessiz geç — boş/empty durum gösterilir */
    } finally {
      if (!background) setLoading(false);
    }
  }, [user]);

  // İlk açılışta skeleton'lı yükle; sonraki odaklanmalarda (sohbetten dönünce) arkaplanda tazele.
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        showAuthPrompt(t("lock_chat_title"));
        return;
      }
      load(hasLoaded.current);
      hasLoaded.current = true;
    }, [load, user, t]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // Büyüteç toggle: kapanınca aramayı temizle.
  const toggleFind = useCallback(() => {
    tapH();
    setShowFind((v) => {
      if (v) { setFindQ(""); setFindResults([]); }
      return !v;
    });
  }, []);

  const openChat = useCallback((c: Conversation) => {
    tapH();
    // Ad/avatarı da geçir → gerçek kullanıcıda sohbet "kişi bulunamadı" demesin.
    router.push({ pathname: "/sohbet/[id]", params: { id: c.id, name: c.name, avatar: c.avatar } });
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
        {admin ? (
          <Pressable onPress={toggleFind} hitSlop={10} style={[styles.iconBtn, { backgroundColor: showFind ? T.primary : T.surfaceStrong }]}>
            <Ionicons name="search" size={20} color={showFind ? "#fff" : T.text} />
          </Pressable>
        ) : (
          <View style={[styles.iconBtn, { backgroundColor: T.surfaceStrong }]}>
            <Ionicons name="create-outline" size={20} color={T.text} />
          </View>
        )}
      </View>

      {/* Admin: büyüteçle açılan "kişi bul → sohbet aç" kutusu (yalnız admin) */}
      {admin && showFind ? (
        <View style={{ marginHorizontal: 14, marginTop: 12 }}>
          <View style={[styles.searchWrap, { backgroundColor: T.surfaceStrong, borderColor: T.primary, marginHorizontal: 0, marginVertical: 0 }]}>
            <Ionicons name="person-add-outline" size={17} color={T.primary} />
            <TextInput
              value={findQ}
              onChangeText={onFindChange}
              placeholder="Kişi bul ve sohbet aç (@ad / e-posta)"
              placeholderTextColor={T.textFaint}
              style={[Type.body, { color: T.text, flex: 1, padding: 0 }]}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {findQ.length > 0 && (
              <Pressable onPress={() => { setFindQ(""); setFindResults([]); }} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color={T.textFaint} />
              </Pressable>
            )}
          </View>
          {findResults.length > 0 ? (
            <View style={[styles.findResults, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              {findResults.map((u) => (
                <Pressable key={u.email} onPress={() => openWithUser(u)} style={styles.findRow}>
                  {u.avatar ? (
                    <Image source={{ uri: u.avatar }} style={styles.findAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.findAvatar, { backgroundColor: T.surface, alignItems: "center", justifyContent: "center" }]}>
                      <Text style={{ fontSize: 14 }}>🙂</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.label, { color: T.text }]} numberOfLines={1}>{u.name || u.email}</Text>
                    <Text style={[Type.micro, { color: T.textFaint }]} numberOfLines={1}>{u.email}</Text>
                  </View>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={T.primary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Gövde: yüklenirken skeleton, boşsa boş durum, doluysa liste */}
      {loading && convos.length === 0 ? (
        <View style={{ paddingTop: 6 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonRow key={i} T={T} />
          ))}
        </View>
      ) : (
        <FlatList
          data={convos}
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
                {!user ? t("lock_chat_title") : t("no_chats")}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => <ConvoRow T={T} c={item} index={index} onPress={() => openChat(item)} />}
        />
      )}
    </View>
  );
}

function ConvoRow({ T, c, index, onPress }: { T: Palette; c: Conversation; index: number; onPress: () => void }) {
  const unread = c.unread > 0;
  return (
    // Kademeli giriş: her satır sırayla aşağıdan belirir (premium his).
    <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 45).duration(380)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, { transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.92 : 1 }]}
      >
        {/* Okunmamışta sol gradient şerit */}
        {unread ? (
          <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.unreadBar} />
        ) : null}

        <View>
          <Image source={{ uri: c.avatar }} style={styles.avatar} contentFit="cover" transition={150} />
          {c.online ? <View style={[styles.onlineDot, { backgroundColor: T.success, borderColor: T.bg }]} /> : null}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Text style={[Type.title, { color: T.text, fontWeight: unread ? "800" : "600", flexShrink: 1 }]} numberOfLines={1}>
              {c.name}
            </Text>
            {c.online ? <Text style={[Type.label, { color: T.success, fontSize: 11, fontWeight: "700" }]}>Aktif</Text> : null}
          </View>
          <Text
            style={[Type.label, { color: unread ? T.text : T.textDim, marginTop: 2, fontWeight: unread ? "700" : "400" }]}
            numberOfLines={1}
          >
            {c.lastText ?? "Yeni eşleşme — selam ver 👋"}
          </Text>
        </View>

        {unread ? (
          <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.badge, glow(T.primary, 10, 0.5)]}>
            <Text style={styles.badgeText}>{c.unread > 99 ? "99+" : c.unread}</Text>
          </LinearGradient>
        ) : (
          <Text style={{ color: T.textFaint, fontSize: 20 }}>›</Text>
        )}
      </Pressable>
    </Animated.View>
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
  findResults: {
    marginTop: 6,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
  },
  findRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  findAvatar: { width: 34, height: 34, borderRadius: 17 },
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
  unreadBar: { position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 90, paddingHorizontal: 40 },
});
