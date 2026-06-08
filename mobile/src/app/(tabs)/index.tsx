import React, { useCallback, useEffect, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ChatBubble } from "@/components/ChatBubble";
import { HeroCard } from "@/components/EventCard";
import { CourseSection } from "@/components/CourseSection";
import { MovieSection } from "@/components/MovieSection";
import { PastEventsSection } from "@/components/PastEventsSection";
import { Loader, Pill } from "@/ui/atoms";
import { Radius, Type, Space } from "@/theme/aurora";
import { CATEGORIES, CITIES } from "@/lib/categories";
import { fetchEvents, type ApiEvent } from "@/lib/api";
import { loadEventsCache, saveEventsCache } from "@/lib/eventCache";
import { dayRange, isPastDay } from "@/lib/format";
import { useActiveCity } from "@/lib/location";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { tapH } from "@/lib/haptics";

const { width } = Dimensions.get("window");
const HERO_W = width - 32;

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { city, status, setCity } = useActiveCity();
  const { user } = useAuth();
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  // Profilde avatar değişince anasayfaya dönüldüğünde güncellensin (her odakta yeniden oku).
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("meydanfest:avatar").then(setAvatarOverride);
    }, []),
  );
  const photoUri = avatarOverride ?? user?.photo;
  const [cityModal, setCityModal] = useState(false);
  const [featured, setFeatured] = useState<ApiEvent[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [day, setDay] = useState<"all" | "today" | "tomorrow" | "weekend">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Şehir+kategori+gün kombinasyonuna göre cache anahtarı.
  const cacheKey = useCallback(
    (category: string | null, useCity: string | null, useDay: string) => `feed:${useCity ?? "auto"}:${category ?? "all"}:${useDay}`,
    []
  );

  const load = useCallback(async (category: string | null, useCity: string | null, useDay: "all" | "today" | "tomorrow" | "weekend") => {
    const key = cacheKey(category, useCity, useDay);

    // 1) Cache varsa HEMEN göster (hızlı ilk boya), spinner'ı kapat.
    const cached = await loadEventsCache(key);
    if (cached) {
      const cachedImg = cached.filter((e) => e.image_url);
      setFeatured((cachedImg.length >= 5 ? cachedImg : cached).slice(0, 6));
      setLoading(false);
    }

    // 2) Ardından taze veriyi çek (hero için), ekranı güncelle ve cache'i yaz.
    try {
      // Seçili güne göre tarih aralığı ("all" → aralık yok).
      const range = dayRange(useDay);
      // Öncelik: bulunduğun şehir. O şehirde sonuç yoksa → genel (random) feed.
      let feedRes = await fetchEvents({ city: useCity ?? undefined, category: category ?? undefined, from: range.from, to: range.to, pageSize: 30 });
      if (useCity && feedRes.data.length === 0) {
        feedRes = await fetchEvents({ category: category ?? undefined, from: range.from, to: range.to, pageSize: 30 });
      }
      const withImg = feedRes.data.filter((e) => e.image_url);
      setFeatured((withImg.length >= 5 ? withImg : feedRes.data).slice(0, 6));
      void saveEventsCache(key, feedRes.data);
    } catch {
      /* cache gösterildiyse koru */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    let alive = true;
    // Spinner SADECE cache yokken görünsün: cache varsa load() içinde anında kapanır.
    void loadEventsCache(cacheKey(cat, city, day)).then((c) => {
      if (alive && !c) setLoading(true);
    });
    load(cat, city, day);
    return () => {
      alive = false;
    };
  }, [cat, city, day, load, cacheKey]);

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(cat, city, day); }} tintColor={T.primary} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
          <Pressable onPress={() => { tapH(); setCityModal(true); }} hitSlop={8}>
            <Text style={[Type.label, { color: T.textFaint }]}>
              {city ? t("your_location") : status === "loading" ? t("locating") : t("welcome")}
            </Text>
            <Text style={[Type.h1, { color: T.text }]}>
              {city ? <>📍 {city} <Text style={{ color: T.primary, fontSize: 16 }}>▾</Text></> : <>Meydan<Text style={{ color: T.primary }}>Fest</Text></>}
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Pressable onPress={() => { tapH(); router.push("/ara"); }} style={[styles.searchBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={{ fontSize: 18 }}>🔍</Text>
            </Pressable>
            {/* Profil — alt bardan kaldırıldı, büyütecin yanında avatar olarak */}
            <Pressable onPress={() => { tapH(); router.push("/profil"); }} style={[styles.searchBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, overflow: "hidden", padding: 0 }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 18 }}>👤</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>

        {loading ? (
          <Loader label={t("loading")} />
        ) : (
          <>
            {/* Hero carousel */}
            {featured.length > 0 && (
              <Animated.View entering={FadeInDown.delay(55).duration(420)}>
                <FlatList
                  horizontal
                  data={featured.filter((e) => !isPastDay(e.starts_at))}
                  keyExtractor={(e) => e.id}
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={HERO_W + 12}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  renderItem={({ item }) => <HeroCard event={item} width={HERO_W} />}
                  style={{ marginBottom: 24 }}
                />
              </Animated.View>
            )}

            {/* Kategori çipleri */}
            <Animated.View entering={FadeInDown.delay(110).duration(420)}>
              <FlatList
                horizontal
                data={[{ key: null, label: t("all"), emoji: "✨" }, ...CATEGORIES] as { key: string | null; label: string; emoji: string }[]}
                keyExtractor={(c) => c.key ?? "all"}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                renderItem={({ item }) => (
                  <Pill label={`${item.emoji} ${item.label}`} active={cat === item.key} onPress={() => setCat(item.key)} />
                )}
                style={{ marginBottom: 14 }}
              />
            </Animated.View>

            {/* Gün filtresi çipleri */}
            <Animated.View entering={FadeInDown.delay(135).duration(420)}>
              <FlatList
                horizontal
                data={[
                  { key: "all", label: "Tümü", emoji: "🗓" },
                  { key: "today", label: "Bugün", emoji: "☀️" },
                  { key: "tomorrow", label: "Yarın", emoji: "🌅" },
                  { key: "weekend", label: "Hafta sonu", emoji: "🎉" },
                ] as { key: "all" | "today" | "tomorrow" | "weekend"; label: string; emoji: string }[]}
                keyExtractor={(d) => d.key}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                renderItem={({ item }) => (
                  <Pill label={`${item.emoji} ${item.label}`} active={day === item.key} onPress={() => setDay(item.key)} />
                )}
                style={{ marginBottom: 26 }}
              />
            </Animated.View>

            {/* Ücretsiz kurslar (belediye scrape) */}
            <CourseSection />

            {/* Vizyondaki filmler (şehre göre + km) */}
            <MovieSection />

            {/* Biten etkinlikler (geçmiş + paylaşımlar) */}
            <PastEventsSection />
          </>
        )}
      </ScrollView>

      <Modal
        visible={cityModal}
        animationType="fade"
        transparent
        onRequestClose={() => setCityModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCityModal(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[Type.h2, { color: T.text }]}>{t("change_location")}</Text>
              <Pressable onPress={() => { tapH(); setCityModal(false); }} hitSlop={10}>
                <Text style={{ fontSize: 22, color: T.textDim }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.cityChips}>
              <Pill
                label={`✦ ${t("use_my_location")}`}
                active={city === null}
                onPress={() => { tapH(); setCity(null); setCityModal(false); }}
              />
              {CITIES.map((c) => (
                <Pill
                  key={c}
                  label={c}
                  active={city === c}
                  onPress={() => { tapH(); setCity(c); setCityModal(false); }}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sürüklenebilir sohbet balonu — geçmiş sohbetlere hızlı erişim */}
      <ChatBubble />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 20 },
  searchBtn: {
    width: 46, height: 46, borderRadius: Radius.md, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    paddingHorizontal: 16,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.lg,
  },
  cityChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.sm,
  },
});
