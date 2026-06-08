import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { tapH, successH } from "@/lib/haptics";
import { AuroraBackground } from "@/components/AuroraBackground";
import { getPerson } from "@/lib/people";
import {
  fetchNotifs,
  fetchFollowing,
  followUser,
  markNotifsRead,
  type SocialNotif,
} from "@/lib/social";

/** Göreli zaman ("3 sa önce") — runtime, kütüphanesiz. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "az önce";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} hf önce`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} ay önce`;
  return `${Math.floor(day / 365)} yıl önce`;
}

/** Aktör id'sinden (fake_uXX → mock kişi) görünen ad + avatar. */
function actorView(n: SocialNotif): { name: string; avatar: string | null } {
  if (n.actorId.startsWith("fake_")) {
    const p = getPerson(n.actorId.replace("fake_", ""));
    if (p) return { name: p.name, avatar: p.avatar };
  }
  return { name: n.actorName || "Biri", avatar: null };
}

export default function BildirimlerScreen() {
  const { t: T } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<SocialNotif[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Geri-takip işleminde butonu beklemeye al (id bazlı).
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async (markRead: boolean) => {
    try {
      const [notifs, fl] = await Promise.all([fetchNotifs(), fetchFollowing()]);
      setItems(notifs.data);
      setFollowing(new Set(fl));
    } catch {
      /* sessiz geç */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    if (markRead) {
      // Açılınca okundu işaretle (sayacı sıfırlar; ana ekran odakta tazeler).
      markNotifsRead().catch(() => {});
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const onFollowBack = useCallback(async (actorId: string) => {
    if (pending.has(actorId) || following.has(actorId)) return;
    successH();
    setPending((p) => new Set(p).add(actorId));
    const res = await followUser(actorId, user?.name);
    if (res.following) {
      setFollowing((f) => new Set(f).add(actorId));
    }
    setPending((p) => {
      const next = new Set(p);
      next.delete(actorId);
      return next;
    });
  }, [pending, following, user?.name]);

  const renderItem = useCallback(
    ({ item, index }: { item: SocialNotif; index: number }) => {
      const { name, avatar } = actorView(item);
      const isFollowing = following.has(item.actorId);
      const isPending = pending.has(item.actorId);
      const showFollowBtn = item.actorId !== "system";

      return (
        <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 10) * 45)}>
          <View
            style={[
              styles.row,
              { backgroundColor: T.bgElevated, borderColor: T.hairline },
              !item.read && { borderLeftWidth: 3, borderLeftColor: T.primary, backgroundColor: T.surfaceStrong },
            ]}
          >
            {/* Aktör avatarı */}
            <View style={[styles.avatar, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 20 }}>{item.actorId === "system" ? "📣" : "👤"}</Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[Type.body, { color: T.text }]} numberOfLines={2}>
                <Text style={{ fontWeight: "800" }}>{name}</Text> seni takip etmeye başladı
              </Text>
              <Text style={[Type.label, { color: T.textFaint, marginTop: 3 }]}>
                {relativeTime(item.createdAt)}
              </Text>
            </View>

            {showFollowBtn ? (
              isFollowing ? (
                <View style={[styles.followBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                  <Text style={[Type.label, { color: T.textDim }]}>Takip ediliyor</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => onFollowBack(item.actorId)}
                  disabled={isPending}
                  style={[styles.followBtn, { backgroundColor: T.primary, borderColor: T.primary, opacity: isPending ? 0.6 : 1 }]}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[Type.label, { color: "#fff" }]}>Geri takip et</Text>
                  )}
                </Pressable>
              )
            ) : null}
          </View>
        </Animated.View>
      );
    },
    [T, following, pending, onFollowBack],
  );

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
        <Text style={[Type.h1, { color: T.text }]}>Bildirimler</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 44, marginBottom: 8 }}>🔔</Text>
          <Text style={[Type.body, { color: T.textDim, textAlign: "center" }]}>Henüz bildirim yok</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + 40, gap: Space.md }}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(false); }}
              tintColor={T.primary}
            />
          }
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  followBtn: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
