import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuroraBackground } from "@/components/AuroraBackground";
import { EventRow } from "@/components/EventCard";
import { EmptyState, Pill } from "@/ui/atoms";
import { Radius, Type, Space, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useActiveCity } from "@/lib/location";
import { catMeta } from "@/lib/categories";
import { fetchEvents, type ApiEvent } from "@/lib/api";
import { tapH, tapHaptic } from "@/lib/haptics";

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Yerel tarihe göre "Y-M-D" gün anahtarı (saat dilimi kaymasız gruplama). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Ayın takvim hücreleri (Pazartesi başlangıçlı): baştaki boşluklar null. */
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // 0=Pzt … 6=Paz
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // Son satırı 7'ye tamamla (grid hizalı kalsın).
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function TakvimScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { city: activeCity } = useActiveCity();

  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  // Şehir kapsamı: null = tüm Türkiye, değilse şehrim. Varsayılan: şehrim (varsa).
  const [cityScope, setCityScope] = useState<string | null>(null);
  const [scopeInit, setScopeInit] = useState(false);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(dayKey(today));

  // Şehrimi tespit edince ilk açılışta kapsamı şehre kilitle.
  useEffect(() => {
    if (!scopeInit && activeCity) {
      setCityScope(activeCity);
      setScopeInit(true);
    }
  }, [activeCity, scopeInit]);

  // Görünen ay için tüm etkinlikleri çek (sayfa sayfa, ~8 sayfa cap).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const from = startOfDay(new Date(cursor.year, cursor.month, 1)).toISOString();
      const to = endOfDay(new Date(cursor.year, cursor.month + 1, 0)).toISOString();
      const all: ApiEvent[] = [];
      try {
        let page = 1;
        let totalPages = 1;
        do {
          const res = await fetchEvents({
            city: cityScope ?? undefined,
            from,
            to,
            page,
            pageSize: 50,
          });
          all.push(...res.data);
          totalPages = res.meta.total_pages;
          page++;
        } while (page <= totalPages && page <= 8);
      } catch {
        /* ağ hatası → boş */
      }
      if (alive) {
        setEvents(all);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cursor.year, cursor.month, cityScope]);

  // Gün anahtarı → o günün etkinlikleri (saate göre sıralı).
  const byDay = useMemo(() => {
    const map = new Map<string, ApiEvent[]>();
    for (const e of events) {
      const d = new Date(e.starts_at);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [events]);

  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor.year, cursor.month]);

  // Ay değişince seçimi mantıklı bir güne taşı: bu ay bugünü içeriyorsa bugün, yoksa
  // etkinliği olan ilk gün, o da yoksa ayın 1'i.
  useEffect(() => {
    const isThisMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
    if (isThisMonth) {
      setSelected(dayKey(today));
      return;
    }
    const firstWithEvents = cells.find((d) => d && byDay.has(dayKey(d)));
    const fallback = cells.find((d): d is Date => !!d);
    setSelected(firstWithEvents ? dayKey(firstWithEvents) : fallback ? dayKey(fallback) : null);
  }, [cursor.year, cursor.month, byDay, cells, today]);

  const goMonth = useCallback((delta: number) => {
    tapHaptic();
    setCursor((c) => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }, []);

  const selectedEvents = selected ? byDay.get(selected) ?? [] : [];
  const monthCount = events.length;

  const renderDay = (d: Date | null, i: number) => {
    if (!d) return <View key={`b${i}`} style={styles.dayCell} />;
    const k = dayKey(d);
    const dayEvents = byDay.get(k);
    const count = dayEvents?.length ?? 0;
    const isToday = k === dayKey(today);
    const isSel = k === selected;
    const isPast = d < today;
    // Nokta rengi: o günün ilk etkinliğinin kategori rengi.
    const dotColor = dayEvents && dayEvents.length > 0 ? catMeta(dayEvents[0].category).gradient[0] : T.textFaint;
    return (
      <Pressable
        key={k}
        style={styles.dayCell}
        onPress={() => { tapH(); setSelected(k); }}
        disabled={count === 0}
      >
        <View
          style={[
            styles.dayInner,
            isSel ? [{ backgroundColor: T.primary }, glow(T.primary, 10, 0.5)] : null,
            isToday && !isSel ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: T.primary } : null,
          ]}
        >
          <Text
            style={[
              Type.body,
              {
                color: isSel ? "#fff" : isPast ? T.textFaint : T.text,
                fontWeight: isToday || isSel ? "800" : "600",
              },
            ]}
          >
            {d.getDate()}
          </Text>
          {/* Etkinlik göstergesi: 1-3 nokta + fazlaysa sayı rozeti */}
          {count > 0 ? (
            count <= 3 ? (
              <View style={styles.dotRow}>
                {Array.from({ length: count }).map((_, di) => (
                  <View key={di} style={[styles.dot, { backgroundColor: isSel ? "#fff" : dotColor }]} />
                ))}
              </View>
            ) : (
              <View style={[styles.countPill, { backgroundColor: isSel ? "rgba(255,255,255,0.3)" : dotColor }]}>
                <Text style={styles.countTxt}>{count}</Text>
              </View>
            )
          ) : (
            <View style={styles.dotRow} />
          )}
        </View>
      </Pressable>
    );
  };

  const selDateLabel = useMemo(() => {
    if (!selected) return "";
    const [y, m, d] = selected.split("-").map(Number);
    const dt = new Date(y, m, d);
    return `${d} ${MONTHS[m]} ${WEEKDAYS[(dt.getDay() + 6) % 7]}`;
  }, [selected]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık + geri */}
        <View style={styles.header}>
          <Pressable onPress={() => { tapHaptic(); router.back(); }} hitSlop={10} style={[styles.backBtn, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
            <Ionicons name="chevron-back" size={22} color={T.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[Type.h1, { color: T.text }]}>Takvim</Text>
            <Text style={[Type.label, { color: T.textFaint }]}>
              {loading ? "Yükleniyor…" : `${monthCount} etkinlik · ${MONTHS[cursor.month]} ${cursor.year}`}
            </Text>
          </View>
        </View>

        {/* Şehir kapsamı */}
        <View style={styles.scopeRow}>
          {activeCity ? (
            <Pill label={`📍 ${activeCity}`} active={cityScope === activeCity} onPress={() => { tapHaptic(); setCityScope(activeCity); setScopeInit(true); }} />
          ) : null}
          <Pill label="🌍 Tüm Türkiye" active={cityScope === null} onPress={() => { tapHaptic(); setCityScope(null); setScopeInit(true); }} />
        </View>

        {/* Ay gezgini */}
        <Animated.View entering={FadeInDown.duration(380)} style={[styles.monthNav, { backgroundColor: T.surface, borderColor: T.hairline }]}>
          <Pressable onPress={() => goMonth(-1)} hitSlop={10} style={styles.navArrow}>
            <Ionicons name="chevron-back" size={22} color={T.text} />
          </Pressable>
          <Text style={[Type.title, { color: T.text }]}>{MONTHS[cursor.month]} {cursor.year}</Text>
          <Pressable onPress={() => goMonth(1)} hitSlop={10} style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={22} color={T.text} />
          </Pressable>
        </Animated.View>

        {/* Hafta günleri */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <View key={w} style={styles.dayCell}>
              <Text style={[Type.micro, { color: T.textFaint, textAlign: "center" }]}>{w}</Text>
            </View>
          ))}
        </View>

        {/* Gün ızgarası */}
        <View style={styles.grid}>
          {cells.map((d, i) => renderDay(d, i))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 30, alignItems: "center" }}>
            <ActivityIndicator color={T.primary} />
          </View>
        ) : null}

        {/* Seçili günün etkinlikleri */}
        <View style={styles.dayList}>
          <Text style={[Type.title, { color: T.text, marginBottom: Space.md }]}>{selDateLabel}</Text>
          {selectedEvents.length === 0 ? (
            <EmptyState emoji="🗓️" title="Bu gün etkinlik yok" sub="Başka bir güne dokun veya ayı değiştir." />
          ) : (
            <Animated.View entering={FadeIn.duration(260)} style={{ gap: 12 }}>
              {selectedEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginBottom: Space.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  scopeRow: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm, paddingHorizontal: 16, marginBottom: Space.lg },
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 16, paddingHorizontal: Space.lg, paddingVertical: Space.md,
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, marginBottom: Space.md,
  },
  navArrow: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  weekRow: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  dayCell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  dayInner: { width: 42, height: 48, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", gap: 3 },
  dotRow: { flexDirection: "row", gap: 2, height: 6, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  countPill: { minWidth: 16, height: 14, borderRadius: 7, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  countTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  dayList: { paddingHorizontal: 16, marginTop: Space.lg },
});
