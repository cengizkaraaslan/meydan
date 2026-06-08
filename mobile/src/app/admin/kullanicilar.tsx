import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { useTheme, type Palette } from "@/lib/theme";
import { tapH } from "@/lib/haptics";
import {
  fetchAdminUsers,
  formatDate,
  formatRelative,
  type AdminUser,
  type AdminApiError,
} from "@/lib/adminApi";

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function StatLine({ T, icon, label, value }: { T: Palette; icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 }}>
      <Text style={{ fontSize: 15 }}>{icon}</Text>
      <Text style={[Type.label, { color: T.textDim, flex: 1 }]}>{label}</Text>
      <Text style={[Type.title, { color: T.text }]}>{value}</Text>
    </View>
  );
}

type Kind = "real" | "fake" | "device";

function Badge({ T, kind }: { T: Palette; kind: Kind }) {
  // 3 durum: gerçek → yeşil, fake → turuncu/altın, normal cihaz → gri.
  const map = {
    real: { color: T.success, bg: "rgba(52,211,153,0.14)", label: "GERÇEK" },
    fake: { color: T.gold, bg: "rgba(245,194,75,0.16)", label: "FAKE" },
    device: { color: T.textFaint, bg: T.surface, label: "CİHAZ" },
  } as const;
  const { color, bg, label } = map[kind];
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[Type.micro, { color }]}>{label}</Text>
    </View>
  );
}

function UserCard({ T, u, i }: { T: Palette; u: AdminUser; i: number }) {
  const [open, setOpen] = useState(false);
  const real = u.type === "real";
  const fake = u.type === "device" && u.isFake;
  const kind: Kind = real ? "real" : fake ? "fake" : "device";
  const accent = real ? T.success : fake ? T.gold : T.textFaint;

  // Fake cihaz satırında ad varsa onu göster, yoksa deviceId.
  const title = real
    ? (u.name || u.email || "İsimsiz")
    : fake
      ? (u.name || `Cihaz ${shortId(u.deviceId)}`)
      : `Cihaz ${shortId(u.deviceId)}`;
  const sub = real ? (u.email ?? "—") : [u.city, u.district].filter(Boolean).join(" · ") || "Konum yok";
  const avatar = real ? u.image : u.avatar;

  return (
    <Animated.View entering={FadeInDown.duration(380).delay(Math.min(i, 12) * 30)}>
      <View style={[styles.card, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }, open ? glow(accent, 16, 0.25) : null]}>
        <Pressable
          onPress={() => { tapH(); setOpen((o) => !o); }}
          style={{ flexDirection: "row", alignItems: "center", gap: Space.md }}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={[styles.avatar, glow(accent, 8, 0.35)]} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={{ fontSize: 20 }}>{real ? "🙂" : "📱"}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[Type.title, { color: T.text, flexShrink: 1 }]} numberOfLines={1}>{title}</Text>
              <Badge T={T} kind={kind} />
            </View>
            <Text style={[Type.label, { color: T.textFaint, marginTop: 3 }]} numberOfLines={1}>{sub}</Text>
            <Text style={[Type.micro, { color: T.textFaint, marginTop: 4 }]}>
              {formatDate(u.createdAt)} · son: {formatRelative(u.updatedAt)}
            </Text>
          </View>
          <Text style={[Type.h2, { color: T.textFaint }]}>{open ? "▾" : "▸"}</Text>
        </Pressable>

        {open ? (
          <Animated.View entering={FadeInDown.duration(220)} style={[styles.expand, { borderTopColor: T.hairline }]}>
            {real ? (
              <>
                <StatLine T={T} icon="🪪" label="Rol" value={u.role || "kullanıcı"} />
                <StatLine T={T} icon="🗓️" label="Kayıt" value={formatDate(u.createdAt)} />
                <StatLine T={T} icon="⏱️" label="Son aktivite" value={formatRelative(u.updatedAt)} />
              </>
            ) : (
              <>
                <StatLine T={T} icon="⭐" label="Favori" value={String(u.favorites)} />
                <StatLine T={T} icon="❤️" label="Beğeni" value={String(u.likes)} />
                <StatLine T={T} icon="🎫" label="Katılım" value={String(u.attendances)} />
                <StatLine T={T} icon="🧭" label="İlçe" value={u.district || "—"} />
                <StatLine T={T} icon="⚧" label="Cinsiyet" value={u.gender || "—"} />
                <StatLine T={T} icon="🗓️" label="Kayıt" value={formatDate(u.createdAt)} />
                <StatLine T={T} icon="⏱️" label="Son aktivite" value={formatRelative(u.updatedAt)} />
              </>
            )}
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t: T } = useTheme();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [realCount, setRealCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);
  const [fakeCount, setFakeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.email ?? "";

  const load = useCallback(async () => {
    if (!email) {
      setError("Oturum bulunamadı.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const resp = await fetchAdminUsers(email);
      setUsers(resp.users);
      setRealCount(resp.realCount);
      setDeviceCount(resp.deviceCount);
      // Fake sayısı: backend verdiyse onu, yoksa listeden say.
      setFakeCount(
        resp.fakeCount ??
          resp.users.filter((u) => u.type === "device" && u.isFake).length,
      );
    } catch (e) {
      setError((e as AdminApiError)?.message ?? "Veri alınamadı.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [email]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  if (!isAdmin(user)) {
    router.replace("/");
    return null;
  }

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => { tapH(); router.back(); }}
          hitSlop={12}
          style={[styles.back, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
        >
          <Text style={{ color: T.text, fontSize: 20 }}>←</Text>
        </Pressable>
        <Text style={[Type.h1, { color: T.text }]}>Kullanıcılar</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {/* Özet */}
        <Animated.View entering={FadeInDown.duration(420)} style={{ flexDirection: "row", gap: Space.md, marginBottom: Space.lg }}>
          <View style={[styles.summary, { backgroundColor: "rgba(52,211,153,0.12)", borderColor: T.success }]}>
            <Text style={[Type.hero, { color: T.success, fontSize: 26 }]}>{realCount}</Text>
            <Text style={[Type.label, { color: T.textDim }]}>Gerçek</Text>
          </View>
          <View style={[styles.summary, { backgroundColor: "rgba(245,194,75,0.12)", borderColor: T.gold }]}>
            <Text style={[Type.hero, { color: T.gold, fontSize: 26 }]}>{fakeCount}</Text>
            <Text style={[Type.label, { color: T.textDim }]}>Fake</Text>
          </View>
          <View style={[styles.summary, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={[Type.hero, { color: T.text, fontSize: 26 }]}>{deviceCount}</Text>
            <Text style={[Type.label, { color: T.textDim }]}>Cihaz</Text>
          </View>
        </Animated.View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={T.primary} />
            <Text style={[Type.label, { color: T.textFaint, marginTop: 10 }]}>Yükleniyor…</Text>
          </View>
        ) : error ? (
          <View style={[styles.card, { backgroundColor: T.surfaceStrong, borderColor: T.pink }]}>
            <Text style={[Type.title, { color: T.pink }]}>Hata</Text>
            <Text style={[Type.body, { color: T.textDim, marginTop: 6 }]}>{error}</Text>
            <Pressable onPress={() => { tapH(); setLoading(true); void load(); }} style={{ marginTop: Space.md }}>
              <Text style={[Type.label, { color: T.primary }]}>Tekrar dene</Text>
            </Pressable>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.center}>
            <Text style={[Type.body, { color: T.textFaint }]}>Henüz kullanıcı yok.</Text>
          </View>
        ) : (
          <View style={{ gap: Space.md }}>
            {users.map((u, i) => (
              <UserCard key={`${u.type}-${u.id}`} T={T} u={u} i={i} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: Space.md,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 16,
  },
  summary: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    gap: 2,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  expand: { marginTop: Space.md, paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 50 },
});
