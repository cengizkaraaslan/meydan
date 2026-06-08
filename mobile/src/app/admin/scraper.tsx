import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { useTheme, type Palette } from "@/lib/theme";
import { tapH, impactH, successH } from "@/lib/haptics";
import {
  fetchScrapers,
  triggerScraper,
  formatRelative,
  formatDuration,
  type ScraperItem,
  type TriggerResp,
  type AdminApiError,
} from "@/lib/adminApi";

function ScraperRow({
  T,
  s,
  i,
  busy,
  onTrigger,
}: {
  T: Palette;
  s: ScraperItem;
  i: number;
  busy: boolean;
  onTrigger: () => void;
}) {
  const run = s.lastRun;
  const hasRun = !!run;
  const ok = run?.success ?? false;
  const statusColor = !hasRun ? T.textFaint : ok ? T.success : T.pink;

  return (
    <Animated.View entering={FadeInDown.duration(360).delay(Math.min(i, 12) * 30)}>
      <View style={[styles.card, { backgroundColor: T.surfaceStrong, borderColor: hasRun && !ok ? T.pink : T.hairline }, hasRun && !ok ? glow(T.pink, 16, 0.25) : null]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: Space.md }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[Type.title, { color: T.text, flexShrink: 1 }]} numberOfLines={1}>{s.label}</Text>
              {hasRun ? (
                <Text style={{ color: statusColor, fontSize: 14 }}>{ok ? "✓" : "✗"}</Text>
              ) : null}
            </View>
            <Text style={[Type.micro, { color: T.textFaint, marginTop: 3 }]}>{s.source}</Text>

            <Text style={[Type.label, { color: T.textDim, marginTop: 6 }]}>
              {hasRun ? `Son: ${formatRelative(run!.finishedAt ?? run!.startedAt)}` : "Hiç çalışmadı"}
            </Text>

            {hasRun ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                <Text style={[Type.micro, { color: T.cyan }]}>bulunan {run!.itemsFound}</Text>
                <Text style={[Type.micro, { color: T.success }]}>yeni {run!.itemsCreated}</Text>
                <Text style={[Type.micro, { color: T.gold }]}>güncel {run!.itemsUpdated}</Text>
                <Text style={[Type.micro, { color: T.textFaint }]}>{formatDuration(run!.durationMs)}</Text>
              </View>
            ) : null}

            {hasRun && run!.errorMessage ? (
              <Text style={[Type.label, { color: T.pink, marginTop: 6, lineHeight: 16 }]} numberOfLines={3}>
                {run!.errorMessage}
              </Text>
            ) : null}
          </View>

          <Pressable onPress={onTrigger} disabled={busy} style={{ borderRadius: Radius.pill, overflow: "hidden", opacity: busy ? 0.6 : 1 }}>
            <LinearGradient colors={T.primarySoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.smallBtn}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[Type.label, { color: "#fff" }]}>Tetikle</Text>}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function AdminScraperScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t: T } = useTheme();

  const [items, setItems] = useState<ScraperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const email = user?.email ?? "";

  const load = useCallback(async () => {
    if (!email) {
      setError("Oturum bulunamadı.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await fetchScrapers(email));
    } catch (e) {
      setError((e as AdminApiError)?.message ?? "Veri alınamadı.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [email]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  const showSummary = useCallback((r: TriggerResp) => {
    setSummary(
      `${r.successCount}/${r.scraperCount} başarılı · ${r.totalWritten} kayıt yazıldı`,
    );
    successH();
  }, []);

  const runAll = useCallback(async () => {
    if (!email || runningAll || runningSource) return;
    impactH();
    setRunningAll(true);
    setSummary(null);
    try {
      const r = await triggerScraper(email);
      showSummary(r);
      await load();
    } catch (e) {
      setSummary((e as AdminApiError)?.message ?? "Çalıştırılamadı.");
    } finally {
      setRunningAll(false);
    }
  }, [email, runningAll, runningSource, showSummary, load]);

  const runOne = useCallback(async (source: string) => {
    if (!email || runningAll || runningSource) return;
    tapH();
    setRunningSource(source);
    setSummary(null);
    try {
      const r = await triggerScraper(email, source);
      const res = r.results[0];
      if (res) {
        setSummary(res.success ? `${source}: ${res.itemsFound} bulundu (${formatDuration(res.durationMs)})` : `${source}: ${res.error ?? "hata"}`);
      } else {
        showSummary(r);
      }
      if (res?.success) successH();
      await load();
    } catch (e) {
      setSummary((e as AdminApiError)?.message ?? "Çalıştırılamadı.");
    } finally {
      setRunningSource(null);
    }
  }, [email, runningAll, runningSource, showSummary, load]);

  if (!isAdmin(user)) {
    router.replace("/");
    return null;
  }

  const anyBusy = runningAll || runningSource !== null;

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
        <Text style={[Type.h1, { color: T.text }]}>Botlar</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {/* Tümünü çalıştır */}
        <Animated.View entering={FadeInDown.duration(420)}>
          <Pressable onPress={runAll} disabled={anyBusy} style={{ borderRadius: Radius.lg, overflow: "hidden", opacity: runningSource ? 0.6 : 1 }}>
            <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigBtn}>
              {runningAll ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={[Type.title, { color: "#fff" }]}>Çalışıyor… (uzun sürebilir)</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 18 }}>🚀</Text>
                  <Text style={[Type.title, { color: "#fff" }]}>Tümünü çalıştır</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {summary ? (
          <Animated.View entering={FadeInDown.duration(280)} style={{ marginTop: Space.md }}>
            <View style={[styles.card, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={[Type.label, { color: T.text, lineHeight: 17 }]}>{summary}</Text>
            </View>
          </Animated.View>
        ) : null}

        <View style={{ height: Space.lg }} />

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
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={[Type.body, { color: T.textFaint }]}>Bot bulunamadı.</Text>
          </View>
        ) : (
          <View style={{ gap: Space.md }}>
            {items.map((s, i) => (
              <ScraperRow
                key={s.source}
                T={T}
                s={s}
                i={i}
                busy={runningSource === s.source}
                onTrigger={() => void runOne(s.source)}
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
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: Space.lg,
  },
  smallBtn: {
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 50 },
});
