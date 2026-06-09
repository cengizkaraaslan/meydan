import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AuroraBackground } from "@/components/AuroraBackground";
import { EventRow } from "@/components/EventCard";
import { SectionHeader, Loader, EmptyState, Pill } from "@/ui/atoms";
import { Radius, Type, Space } from "@/theme/aurora";
import { CATEGORIES, catMeta } from "@/lib/categories";
import { API_BASE, fetchEvents, type ApiEvent } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useActiveCity, ALL_CITIES, districtsFor } from "@/lib/location";
import { tapH } from "@/lib/haptics";

const PRICE_LABELS: Record<"all" | "free" | "paid" | "student", string> = {
  all: "f_all",
  free: "f_free",
  paid: "f_paid",
  student: "f_student",
};

/** Türkçe-duyarlı küçültme (case-insensitive arama için). */
function lower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

/** Sayfa başına kayıt (10'ar 10'ar pagination). */
const PAGE_SIZE = 10;

export default function KategorilerScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { city: activeCity } = useActiveCity();
  // Çoklu seçim: varsayılan olarak TÜM kategoriler seçili gelir (boş değil) →
  // sayfa açılır açılmaz (kendi şehrinde) etkinlikler listelenir.
  const [selected, setSelected] = useState<string[]>(() => CATEGORIES.map((c) => c.key));
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [cityInit, setCityInit] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid" | "student">("all");
  // İlçe filtresi (#C2): seçili şehrin gerçek ilçeleri API'den çekilir; null = tüm ilçeler.
  const [district, setDistrict] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(false);
  // Pagination: page = yüklü son sayfa, totalPages = sunucudaki toplam sayfa.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasSelection = selected.length > 0;

  // Varsayılan şehir = bulunduğu şehir (yalnızca ilk tespitte ata).
  useEffect(() => {
    if (!cityInit && activeCity) {
      setCityFilter(activeCity);
      setCityInit(true);
    }
  }, [activeCity, cityInit]);

  // Seçili şehrin gerçek ilçelerini çek (#C2). "Tüm şehirler" (null) → ilçe filtresi yok.
  useEffect(() => {
    setDistrict(null);
    if (!cityFilter) {
      setDistricts([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/districts?city=${encodeURIComponent(cityFilter)}`);
        const json = (await res.json()) as { districts?: string[] };
        const apiList = Array.isArray(json.districts) ? json.districts : [];
        // API boş dönerse yerel yedek listeyi kullan → ilçe filtresi hep görünür.
        if (alive) setDistricts(apiList.length ? apiList : districtsFor(cityFilter));
      } catch {
        if (alive) setDistricts(districtsFor(cityFilter));
      }
    })();
    return () => {
      alive = false;
    };
  }, [cityFilter]);

  // Etkinlikleri çek. Şehir + fiyat (free) filtresi sunucu tarafında uygulanır.
  // Kategori dizisi `selected` değiştiğinde (string'e çevrilerek) yeniden tetiklenir.
  const selectedKey = selected.join(",");
  // Tek kategori seçiliyse sunucu `category` paramıyla verimli/doğru sayfalama;
  // çoklu/tüm seçimde kategori filtresi client'ta (visibleEvents) uygulanır.
  const serverCategory = selected.length === 1 ? selected[0] : undefined;

  // Filtre değişince sayfa 1'den taze çek. Sonuç HAM şehir feed'i olarak tutulur;
  // kategori/fiyat/ilçe filtreleri visibleEvents'te uygulanır (sayfalama bozulmasın).
  useEffect(() => {
    if (selected.length === 0) {
      setEvents([]);
      setTotalPages(1);
      return;
    }
    let alive = true;
    setLoading(true);
    setEvents([]);
    setPage(1);
    (async () => {
      try {
        const res = await fetchEvents({
          city: cityFilter ?? undefined,
          category: serverCategory,
          freeOnly: priceFilter === "free",
          page: 1,
          pageSize: PAGE_SIZE,
        });
        if (alive) {
          setEvents(res.data);
          setTotalPages(res.meta.total_pages);
        }
      } catch {
        if (alive) {
          setEvents([]);
          setTotalPages(1);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedKey, serverCategory, cityFilter, priceFilter]);

  // Sonraki sayfayı çek ve listeye ekle (10'ar 10'ar).
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetchEvents({
        city: cityFilter ?? undefined,
        category: serverCategory,
        freeOnly: priceFilter === "free",
        page: next,
        pageSize: PAGE_SIZE,
      });
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...res.data.filter((e) => !seen.has(e.id))];
      });
      setPage(next);
      setTotalPages(res.meta.total_pages);
    } catch {
      /* yoksay */
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, page, totalPages, cityFilter, serverCategory, priceFilter]);

  // İlçe filtresi (#C2): seçili ilçe (null = tümü). Veride district alanı yok →
  // venue/title içinde ilçe adı geçenleri göster.
  const visibleEvents = useMemo(() => {
    const sel = new Set(selected);
    let data = events.filter((e) => sel.has(e.category));
    // Gelişmiş fiyat: paid → biletli, student → üniversite kaynakları (öğrenciye açık).
    if (priceFilter === "paid") data = data.filter((e) => !e.is_free);
    else if (priceFilter === "student") data = data.filter((e) => (e.source || "").startsWith("UNI") || e.is_free);
    // İlçe (#C2): veride district yok → venue/title içinde ilçe adı geçenler.
    if (district) {
      const q = lower(district);
      data = data.filter((e) => lower(e.venue || "").includes(q) || lower(e.title || "").includes(q));
    }
    return data;
  }, [events, selected, priceFilter, district]);

  const toggleCategory = (key: string) => {
    tapH();
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // EmptyState alt metni: şehir seçiliyse "{şehir}'de bu kategoride etkinlik yok".
  const emptySub = cityFilter
    ? `${cityFilter}${T_suffix(cityFilter)} bu kategoride etkinlik yok`
    : t("try_another");

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          // Sona ~500px kala bir sonraki sayfayı otomatik yükle (sonsuz kaydırma).
          if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 500) loadMore();
        }}
        scrollEventThrottle={250}
      >
        <Animated.View entering={FadeInDown.duration(450)}>
          <Text style={[Type.h1, styles.title, { color: T.text }]}>{t("categories")}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450)} style={styles.locWrap}>
          <Pressable
            onPress={() => {
              tapH();
              setCityOpen((v) => !v);
            }}
            style={[
              styles.locHeader,
              { backgroundColor: T.surfaceStrong, borderColor: T.hairline },
            ]}
          >
            <Text style={[Type.label, { color: T.textDim }]}>📍 {t("location_filter")}</Text>
            <Text style={[Type.label, { color: T.text }]}>
              {(cityFilter ?? t("all_cities")) + "  " + (cityOpen ? "▲" : "▼")}
            </Text>
          </Pressable>

          {cityOpen ? (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.cityChips}>
              <Pill
                label={t("all_cities")}
                active={cityFilter === null}
                onPress={() => {
                  tapH();
                  setCityFilter(null);
                  setCityInit(true);
                  setCityOpen(false);
                }}
              />
              {ALL_CITIES.map((c) => (
                <Pill
                  key={c}
                  label={c}
                  active={cityFilter === c}
                  onPress={() => {
                    tapH();
                    setCityFilter(c);
                    setCityInit(true);
                    setCityOpen(false);
                  }}
                />
              ))}
            </Animated.View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(450)} style={styles.locWrap}>
          <Pressable
            onPress={() => {
              tapH();
              setAdvOpen((v) => !v);
            }}
            style={[
              styles.locHeader,
              { backgroundColor: T.surfaceStrong, borderColor: T.hairline },
            ]}
          >
            <Text style={[Type.label, { color: T.textDim }]}>⚙️ {t("advanced_filter")}</Text>
            <Text style={[Type.label, { color: T.text }]}>
              {t(PRICE_LABELS[priceFilter]) + "  " + (advOpen ? "▲" : "▼")}
            </Text>
          </Pressable>

          {advOpen ? (
            <Animated.View entering={FadeInDown.duration(260)} style={styles.advBody}>
              <View style={styles.cityChips}>
                {(["all", "free", "paid", "student"] as const).map((p) => (
                  <Pill
                    key={p}
                    label={t(PRICE_LABELS[p])}
                    active={priceFilter === p}
                    onPress={() => {
                      tapH();
                      setPriceFilter(p);
                    }}
                  />
                ))}
              </View>
              {/* İlçe filtresi (#C2): seçili şehrin gerçek ilçeleri. "Tüm şehirler"de veya
                  ilçe verisi yoksa gizli. */}
              {cityFilter && districts.length > 0 ? (
                <>
                  <Text style={[Type.label, { color: T.textDim, marginTop: Space.md, marginBottom: Space.sm }]}>
                    {t("district")}
                  </Text>
                  <View style={styles.cityChips}>
                    <Pill
                      label={t("all_districts")}
                      active={district === null}
                      onPress={() => {
                        tapH();
                        setDistrict(null);
                      }}
                    />
                    {districts.map((d) => (
                      <Pill
                        key={d}
                        label={d}
                        active={district === d}
                        onPress={() => {
                          tapH();
                          setDistrict(district === d ? null : d);
                        }}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>

        <View style={styles.grid}>
          {CATEGORIES.map((item, i) => {
            const active = selected.includes(item.key);
            // Seçili tile zaten beyaz çerçeve + ✓ + güçlü glow ile belli oluyor;
            // diğerlerini KARARTMIYORUZ (eski 0.4 opacity "bozuk/karardı" gibi duruyordu).
            return (
              <Animated.View
                key={item.key}
                entering={FadeInDown.delay(Math.min(i, 8) * 55).duration(420)}
                style={styles.cell}
              >
                <Pressable onPress={() => toggleCategory(item.key)}>
                  <LinearGradient
                    colors={item.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.tile,
                      active && styles.tileActive,
                    ]}
                  >
                    {active ? (
                      <View style={styles.check}>
                        <Text style={styles.checkTxt}>✓</Text>
                      </View>
                    ) : null}
                    <Text style={styles.emoji}>{item.emoji}</Text>
                    <Text style={[Type.title, styles.tileLabel]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {hasSelection ? (
          <View style={styles.results}>
            {loading ? (
              <Loader label={t("loading")} />
            ) : visibleEvents.length === 0 ? (
              <EmptyState emoji="🌌" title={t("no_result")} sub={emptySub} />
            ) : (
              <>
                <SectionHeader
                  title={selected.length === 1 ? catMeta(selected[0]).label : `${selected.length} ${t("categories")}`}
                />
                {visibleEvents.map((e, i) => (
                  <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 8) * 55).duration(420)}>
                    <EventRow event={e} />
                  </Animated.View>
                ))}
                {/* 10'ar 10'ar sayfalama: daha varsa buton/oto-yükle; bittiyse kapanış */}
                {page < totalPages ? (
                  <Pressable
                    onPress={loadMore}
                    disabled={loadingMore}
                    style={[styles.loadMore, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={T.primary} />
                    ) : (
                      <Text style={[Type.title, { color: T.primary }]}>Daha fazla göster</Text>
                    )}
                  </Pressable>
                ) : visibleEvents.length > 0 ? (
                  <Text style={[Type.label, { color: T.textFaint, textAlign: "center", marginTop: Space.lg }]}>
                    Hepsi bu kadar ✦
                  </Text>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <Text style={[Type.body, styles.hint, { color: T.textFaint }]}>{t("pick_category")}</Text>
        )}
      </ScrollView>
    </View>
  );
}

/** "İstanbul" → "'da", sesli uyumu basitçe: kalın ünlü bitişlerde 'da, ince 'de. */
function T_suffix(city: string): string {
  const last = lower(city).replace(/[^a-zçğıöşü]/g, "").slice(-1);
  const back = "aıou".includes(last);
  return back ? "'da" : "'de";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { paddingHorizontal: 16, marginBottom: Space.md },
  locWrap: { paddingHorizontal: 16, marginBottom: Space.lg },
  locHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  cityChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.sm,
    marginTop: Space.md,
  },
  advBody: { marginTop: 0 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: Space.md,
  },
  cell: { width: "47%", flexGrow: 1 },
  tile: {
    height: 110,
    borderRadius: Radius.lg,
    padding: Space.lg,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  tileActive: {
    borderWidth: StyleSheet.hairlineWidth * 4,
    borderColor: "rgba(255,255,255,0.9)",
  },
  check: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkTxt: { fontSize: 13, fontWeight: "900", color: "#1A1430" },
  emoji: { fontSize: 30 },
  tileLabel: { color: "#fff" },
  results: { marginTop: Space.xl, paddingHorizontal: 16 },
  loadMore: {
    marginTop: Space.lg,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    textAlign: "center",
    marginTop: Space.xxl,
    paddingHorizontal: 30,
  },
});
