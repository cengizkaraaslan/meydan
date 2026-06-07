import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { EventRow } from "@/components/EventCard";
import { Loader, EmptyState } from "@/ui/atoms";
import { Radius, Type, Space, glow } from "@/theme/aurora";
import { Pill } from "@/ui/atoms";
import { fetchEvents, type ApiEvent } from "@/lib/api";
import { fmtDay } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";
import { useAuth } from "@/lib/auth";
import { tapH } from "@/lib/haptics";

type CalTab = "general" | "attending";

/** YYYY-MM-DD anahtarı (yerel saate göre). */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DaySection {
  key: string;
  iso: string; // grubun ilk etkinliğinin ISO'su (rozet için)
  events: ApiEvent[];
}

export default function TakvimScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { user, guest } = useAuth();
  const { list: favorites } = useFavorites();
  const [tab, setTab] = useState<CalTab>("general");
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const signedIn = Boolean(user || guest);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchEvents({ pageSize: 50 });
        if (!alive) return;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const upcoming = res.data
          .filter((e) => new Date(e.starts_at).getTime() >= startOfToday.getTime())
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        setEvents(upcoming);
      } catch {
        if (alive) setEvents([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // "Katılacaklarım" = favoriler; yaklaşanlar, tarihe göre sıralı.
  const attending = useMemo<ApiEvent[]>(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return favorites
      .filter((e) => new Date(e.starts_at).getTime() >= startOfToday.getTime())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [favorites]);

  const source = tab === "attending" ? attending : events;

  const sections = useMemo<DaySection[]>(() => {
    const groups: Record<string, ApiEvent[]> = {};
    const order: string[] = [];
    for (const e of source) {
      const k = dayKey(e.starts_at);
      if (!groups[k]) {
        groups[k] = [];
        order.push(k);
      }
      groups[k].push(e);
    }
    return order.map((k) => ({ key: k, iso: groups[k][0].starts_at, events: groups[k] }));
  }, [source]);

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 130,
          paddingHorizontal: 16,
        }}
      >
        <Animated.View entering={FadeInDown.duration(450)}>
          <Text style={[Type.h1, styles.title, { color: T.text }]}>{t("calendar")}</Text>
          <Text style={[Type.label, styles.subtitle, { color: T.textFaint }]}>
            {tab === "general" && loading
              ? t("loading")
              : t("upcoming_n", { count: source.length })}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450)} style={styles.segment}>
          <Pill
            label={t("cal_general")}
            active={tab === "general"}
            onPress={() => {
              tapH();
              setTab("general");
            }}
          />
          <Pill
            label={t("cal_attending")}
            active={tab === "attending"}
            onPress={() => {
              tapH();
              setTab("attending");
            }}
          />
        </Animated.View>

        {tab === "attending" && !signedIn ? (
          <EmptyState emoji="🔒" title={t("attending_login")} />
        ) : tab === "general" && loading ? (
          <Loader label={t("loading")} />
        ) : sections.length === 0 ? (
          <EmptyState emoji="🗓️" title={t("no_upcoming")} />
        ) : (
          sections.map((sec, i) => {
            const { day, month, weekday } = fmtDay(sec.iso);
            return (
              <Animated.View
                key={sec.key}
                entering={FadeInDown.delay(Math.min(i, 8) * 55).duration(420)}
                style={styles.section}
              >
                <View style={styles.sectionHead}>
                  <LinearGradient
                    colors={T.primarySoft}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.badge, glow(T.indigo, 16, 0.45)]}
                  >
                    <Text style={[Type.h1, styles.badgeDay]}>{day}</Text>
                    <Text style={styles.badgeMonth}>{month}</Text>
                  </LinearGradient>
                  <View style={styles.headMeta}>
                    <Text style={[Type.title, { color: T.text }]}>{weekday}</Text>
                    <Text style={[Type.label, { color: T.textFaint }]}>
                      {t("fav_count", { count: sec.events.length })}
                    </Text>
                  </View>
                </View>

                <View style={styles.eventList}>
                  {sec.events.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { marginTop: Space.sm },
  subtitle: { marginTop: 4, marginBottom: Space.lg },
  segment: { flexDirection: "row", gap: Space.sm, marginBottom: Space.xl },
  section: { marginBottom: Space.xxl },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    marginBottom: Space.md,
  },
  badge: {
    width: 60,
    height: 64,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDay: { color: "#fff", lineHeight: 30 },
  badgeMonth: {
    ...Type.micro,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
    textTransform: "uppercase",
  },
  headMeta: { flex: 1, gap: 2 },
  eventList: { gap: Space.md },
});
