import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { tapH, tapHaptic, successH } from "@/lib/haptics";
import { AuroraBackground } from "@/components/AuroraBackground";
import { getPerson } from "@/lib/people";
import { resolveAvatar } from "@/lib/avatar";
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

/** Aktör id'sinden görünen ad + HER ZAMAN bir görsel URL (3 durum: Drive→dönüştür / bize-yüklenen /
 *  yok→default). system aktöründe avatar boş (📣 emojisi gösterilir). */
function actorView(n: SocialNotif): { name: string; avatar: string | null } {
  if (n.actorId === "system") return { name: n.actorName || "Meydan", avatar: null };
  if (n.actorId.startsWith("fake_")) {
    const p = getPerson(n.actorId.replace("fake_", ""));
    if (p) return { name: p.name, avatar: resolveAvatar(p.avatar, p.name, null) };
  }
  const name = n.actorName || "Biri";
  // Gerçek kullanıcı: backend'in çözdüğü avatar (Drive/R2/Google) → normalize + default fallback.
  return { name, avatar: resolveAvatar(n.actorAvatar, name, null) };
}

/** DM gövdesinden (📷/🎤) medya türü → bildirimde "fotoğraf/sesli mesaj gönderdi" demek için. */
function dmMedia(body?: string | null): "photo" | "voice" | null {
  if (!body) return null;
  if (body.includes("📷")) return "photo";
  if (body.includes("🎤")) return "voice";
  return null;
}

/** Aynı kişiden aynı türdeki bildirimleri TEK satırda topla (Instagram tarzı):
 *  "X sana 4 mesaj attı". En yeni temsilci olarak korunur; herhangi biri okunmamışsa grup okunmamış. */
interface NotifGroup {
  key: string;
  rep: SocialNotif; // en yeni
  count: number; // gruptaki toplam
  unreadCount: number; // gruptaki OKUNMAMIŞ sayısı (bildirimde gösterilen sayı budur)
  unread: boolean;
}
function groupNotifs(items: SocialNotif[]): NotifGroup[] {
  const byKey = new Map<string, NotifGroup>();
  const order: string[] = [];
  for (const n of items) {
    // follow gruplanmaz (geri-takip butonu kişiye özel); diğerleri actorId+type ile gruplanır.
    const key = n.type === "follow" ? `follow:${n.id}` : `${n.type}:${n.actorId}`;
    const g = byKey.get(key);
    if (g) {
      g.count += 1;
      if (!n.read) g.unreadCount += 1;
      g.unread = g.unread || !n.read;
    } else {
      byKey.set(key, { key, rep: n, count: 1, unreadCount: n.read ? 0 : 1, unread: !n.read });
      order.push(key);
    }
  }
  return order.map((k) => byKey.get(k)!);
}

export default function BildirimlerScreen() {
  const { t: T } = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<SocialNotif[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Geri-takip işleminde butonu beklemeye al (id bazlı).
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Aynı kişiden gelen aynı tür bildirimleri tek satırda topla (Instagram tarzı).
  const grouped = useMemo(() => groupNotifs(items), [items]);

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

  // Her odaklandığında (sohbeti okuyup geri dönünce de) yenile → okunan bildirimler okundu görünsün.
  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load]),
  );

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
    ({ item: g, index }: { item: NotifGroup; index: number }) => {
      const item = g.rep;
      const { name, avatar } = actorView(item);
      const isFollowing = following.has(item.actorId);
      const isPending = pending.has(item.actorId);
      const isFollow = item.type === "follow";
      const showFollowBtn = isFollow && item.actorId !== "system";
      // Gösterilen sayı OKUNMAMIŞ adettir (hepsi okunduysa sayı gösterilmez).
      const n = g.unreadCount;
      // DM'de tek (okunmamış) mesajsa medya türünü belirt; çoklu ise "N mesaj".
      const media = dmMedia(item.body);
      const dmAction =
        n > 1
          ? t("notif_dm_n", { n })
          : media === "photo"
            ? t("notif_dm_photo")
            : media === "voice"
              ? t("notif_dm_voice")
              : t("notif_dm");
      const ACTION: Record<string, string> = {
        follow: "seni takip etmeye başladı",
        mention: n > 1 ? `seni ${n} kez etiketledi` : "seni bir paylaşımda etiketledi",
        comment: n > 1 ? `${n} kez senden bahsetti` : "bir yorumda senden bahsetti",
        feed_comment: n > 1 ? `${n} kez senden bahsetti` : "bir yorumda senden bahsetti",
        dm: dmAction,
      };
      const action = ACTION[item.type] ?? "seninle etkileşime geçti";

      return (
        <Animated.View entering={FadeInDown.duration(360).delay(Math.min(index, 10) * 35)}>
          <Pressable
            onPress={() => {
              tapHaptic();
              // DM → doğrudan ilgili sohbeti aç (anahtar chat'te ensureMatch'le çözülür).
              if (item.type === "dm" && item.actorId) {
                router.push({ pathname: "/sohbet/[id]", params: { id: item.actorId, name: name ?? "", avatar: avatar ?? "" } } as never);
              } else if (item.target) {
                router.push(item.target as never);
              }
            }}
            style={[
              styles.row,
              { borderBottomColor: T.hairline },
              g.unread && { backgroundColor: T.surfaceStrong },
            ]}
          >
            {/* Aktör avatarı (küçük) */}
            <View style={[styles.avatar, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 15 }}>{item.actorId === "system" ? "📣" : "👤"}</Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[Type.label, { color: T.text, lineHeight: 17 }]} numberOfLines={2}>
                <Text style={{ fontWeight: "700" }}>{name}</Text> {action}
                <Text style={{ color: T.textFaint, fontWeight: "400" }}>  ·  {relativeTime(item.createdAt)}</Text>
              </Text>
              {item.body && !(item.type === "dm" && media) ? (
                <Text style={[Type.micro, { color: T.textDim, marginTop: 1 }]} numberOfLines={1}>
                  {item.body}
                </Text>
              ) : null}
            </View>

            {/* Okunmamış noktası */}
            {g.unread ? <View style={[styles.unreadDot, { backgroundColor: T.primary }]} /> : null}

            {showFollowBtn ? (
              isFollowing ? (
                <View style={[styles.followBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                  <Text style={[Type.micro, { color: T.textDim }]}>Takip ediliyor</Text>
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
                    <Text style={[Type.micro, { color: "#fff", fontWeight: "700" }]}>Geri takip et</Text>
                  )}
                </Pressable>
              )
            ) : null}
          </Pressable>
        </Animated.View>
      );
    },
    [T, t, following, pending, onFollowBack],
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
          data={grouped}
          keyExtractor={(g) => g.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
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
    gap: 10,
    paddingHorizontal: Space.lg,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  followBtn: {
    minWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
