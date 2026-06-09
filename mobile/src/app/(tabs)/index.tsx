import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { CATEGORIES } from "@/lib/categories";
import { fetchEvents, type ApiEvent } from "@/lib/api";
import { loadEventsCache, saveEventsCache } from "@/lib/eventCache";
import { dayRange, isPastDay } from "@/lib/format";
import { useActiveCity, ALL_CITIES } from "@/lib/location";
import { COUNTRIES, DEFAULT_COUNTRY, countryByCode, type Country } from "@/lib/countries";
import * as Location from "expo-location";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { fetchNotifs } from "@/lib/social";
import { resolveAvatar } from "@/lib/avatar";
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
  const [gender, setGender] = useState<string | null>(null);
  // Profilde avatar/cinsiyet değişince anasayfaya dönüldüğünde güncellensin (her odakta yeniden oku).
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("meydanfest:avatar").then(setAvatarOverride);
      AsyncStorage.getItem("meydanfest:gender").then(setGender);
    }, []),
  );
  const photoUri = avatarOverride ?? user?.photo;
  // Okunmamış bildirim sayacı — ekran her odaklandığında tazelenir.
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchNotifs().then((r) => { if (alive) setUnread(r.unread); }).catch(() => {});
      return () => { alive = false; };
    }, []),
  );
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLocaleLowerCase("tr");
    return q ? ALL_CITIES.filter((c) => c.toLocaleLowerCase("tr").includes(q)) : ALL_CITIES;
  }, [citySearch]);

  // Ülke seçimi (varsayılan Türkiye). AsyncStorage'dan yüklenir/kaydedilir.
  const [country, setCountryState] = useState<Country>(DEFAULT_COUNTRY);
  const [countryList, setCountryList] = useState(false); // modal içinde ülke liste görünümü açık mı
  const [countrySearch, setCountrySearch] = useState("");
  const isTR = country.code === "TR";
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLocaleLowerCase("tr");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.tr.toLocaleLowerCase("tr").includes(q) || c.name.toLowerCase().includes(q.toLowerCase()),
    );
  }, [countrySearch]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem("meydanfest:country").then((code) => {
      if (!alive) return;
      const c = countryByCode(code ?? undefined);
      if (c) setCountryState(c);
    });
    return () => { alive = false; };
  }, []);

  const setCountry = useCallback((c: Country) => {
    setCountryState(c);
    void AsyncStorage.setItem("meydanfest:country", c.code);
  }, []);

  // "Konumumu kullan": GPS şehir akışı + ters jeokodla ülkeyi otomatik seç.
  const handleUseLocation = useCallback(async () => {
    setCity(null); // Türkiye şehir akışı: manuel şehri temizle → GPS tespiti devreye girsin
    setCityModal(false);
    setCitySearch("");
    setCountryList(false);
    setCountrySearch("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
      let pos = await Location.getLastKnownPositionAsync();
      if (!pos) pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!pos) return;
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const iso = geo[0]?.isoCountryCode;
      const detected = countryByCode(iso ?? undefined);
      if (detected) setCountry(detected);
      else setCountry(DEFAULT_COUNTRY);
    } catch {
      /* sessizce geç */
    }
  }, [setCity, setCountry]);
  const [featured, setFeatured] = useState<ApiEvent[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [day, setDay] = useState<"all" | "today" | "tomorrow" | "weekend">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Tam-ekran Loader yalnız ilk yüklemede; sonraki şehir/gün değişiminde hero kaybolmasın.
  const loadedOnce = useRef(false);

  // Ülke+şehir+kategori+gün kombinasyonuna göre cache anahtarı.
  const cacheKey = useCallback(
    (category: string | null, useCity: string | null, useDay: string, ctry: string) =>
      `feed:${ctry}:${useCity ?? "auto"}:${category ?? "all"}:${useDay}`,
    []
  );

  const load = useCallback(async (category: string | null, useCity: string | null, useDay: "all" | "today" | "tomorrow" | "weekend", ctry: Country) => {
    const trCountry = ctry.code === "TR";
    const key = cacheKey(category, trCountry ? useCity : null, useDay, ctry.code);

    // 1) Cache varsa HEMEN göster (hızlı ilk boya), spinner'ı kapat.
    const cached = await loadEventsCache(key);
    const hadCache = !!(cached && cached.length > 0);
    if (hadCache) {
      const cachedImg = cached!.filter((e) => e.image_url);
      setFeatured((cachedImg.length >= 5 ? cachedImg : cached!).slice(0, 6));
      setLoading(false);
    }

    // 2) Ardından taze veriyi çek (hero için), ekranı güncelle ve cache'i yaz.
    try {
      // Seçili güne göre tarih aralığı ("all" → aralık yok).
      const range = dayRange(useDay);
      let feedRes;
      if (!trCountry) {
        // Yurt dışı: o ülkenin etkinlikleri (şehir filtresi yok).
        feedRes = await fetchEvents({ country: ctry.name, category: category ?? undefined, from: range.from, to: range.to, pageSize: 30 });
      } else {
        // Türkiye: öncelik bulunduğun şehir. O şehirde sonuç yoksa → genel (random) feed.
        feedRes = await fetchEvents({ city: useCity ?? undefined, category: category ?? undefined, from: range.from, to: range.to, pageSize: 30 });
        if (useCity && feedRes.data.length === 0) {
          feedRes = await fetchEvents({ category: category ?? undefined, from: range.from, to: range.to, pageSize: 30 });
        }
      }
      const withImg = feedRes.data.filter((e) => e.image_url);
      const list = (withImg.length >= 5 ? withImg : feedRes.data).slice(0, 6);
      // Boş TAZE sonuç, gösterilmiş hero'yu (cache/önceki) ASLA boşaltmasın — "Ankara
      // geldi sonra slider kalktı" buydu: cache dolu gösterilip taze fetch boş dönünce
      // ilk yüklemede setFeatured([]) hero'yu siliyordu. Yalnız hiç veri yokken boş set.
      if (list.length > 0 || (!loadedOnce.current && !hadCache)) setFeatured(list);
      void saveEventsCache(key, feedRes.data);
    } catch {
      /* cache gösterildiyse koru */
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadedOnce.current = true;
    }
  }, [cacheKey]);

  useEffect(() => {
    let alive = true;
    // Spinner SADECE cache yokken görünsün: cache varsa load() içinde anında kapanır.
    void loadEventsCache(cacheKey(cat, isTR ? city : null, day, country.code)).then((c) => {
      if (alive && !c && !loadedOnce.current) setLoading(true);
    });
    load(cat, city, day, country);
    return () => {
      alive = false;
    };
  }, [cat, city, day, country, isTR, load, cacheKey]);

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(cat, city, day, country); }} tintColor={T.primary} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
          <Pressable onPress={() => { tapH(); setCityModal(true); }} hitSlop={8}>
            <Text style={[Type.label, { color: T.textFaint }]}>
              {!isTR ? t("your_location") : city ? t("your_location") : status === "loading" ? t("locating") : t("welcome")}
            </Text>
            <Text style={[Type.h1, { color: T.text }]}>
              {!isTR ? (
                <>{country.flag} {country.tr} <Text style={{ color: T.primary, fontSize: 16 }}>▾</Text></>
              ) : city ? (
                <>📍 {city} <Text style={{ color: T.primary, fontSize: 16 }}>▾</Text></>
              ) : (
                <>Meydan<Text style={{ color: T.primary }}>Fest</Text></>
              )}
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            {/* Bildirim zili — okunmamış sayacı rozetiyle */}
            <Pressable onPress={() => { tapH(); router.push("/bildirimler"); }} style={[styles.searchBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={{ fontSize: 15 }}>🔔</Text>
              {unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: "#EF4444", borderColor: T.bg }]}>
                  <Text style={styles.badgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
                </View>
              ) : null}
            </Pressable>
            {/* Profil — alt bardan kaldırıldı, başlıkta avatar olarak */}
            <Pressable onPress={() => { tapH(); router.push("/profil"); }} style={[styles.searchBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, overflow: "hidden", padding: 0 }]}>
              <Image source={{ uri: resolveAvatar(photoUri, user?.name, gender) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </Pressable>
          </View>
        </Animated.View>

        {loading ? (
          <Loader label={t("loading")} />
        ) : (
          <>
            {/* Hero carousel — yatay ScrollView (FlatList değil): dikey ScrollView içine
                gömülü yatay VirtualizedList, login sonrası fresh mount'ta cache dolu gelince
                genişliği 0 ölçüp BOŞ kalıyordu (ancak pull-refresh ile geliyordu). ≤6 öğe
                olduğundan sanallaştırma gereksiz; ScrollView mount'ta güvenilir çizer. */}
            {/* NOT: hero'da reanimated `entering` KULLANMA. Temiz kurulumda (uninstall+
                reinstall) intro/Walkthrough overlay'i üstte olduğundan ekran kapalıyken
                mount oluyor; entering animasyonu slider'ı opacity:0/kayık bırakıp ancak
                refresh'te düzeltiyordu. Düz View → her zaman görünür. */}
            {featured.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={HERO_W + 12}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  style={{ marginBottom: 24 }}
                >
                  {featured
                    .filter((e) => !isPastDay(e.starts_at))
                    .map((item) => (
                      <HeroCard key={item.id} event={item} width={HERO_W} />
                    ))}
                </ScrollView>
              </View>
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
              <Pressable onPress={() => { tapH(); setCityModal(false); setCitySearch(""); }} hitSlop={10}>
                <Text style={{ fontSize: 22, color: T.textDim }}>✕</Text>
              </Pressable>
            </View>

            {/* Konumu kullan — ülke + (TR ise) şehri otomatik tespit eder */}
            <Pressable
              onPress={() => { tapH(); void handleUseLocation(); }}
              style={[styles.useLoc, { borderColor: city === null && isTR ? T.primary : T.hairline, backgroundColor: T.surfaceStrong }]}
            >
              <Text style={[Type.title, { color: city === null && isTR ? T.primary : T.text }]}>✦ {t("use_my_location")}</Text>
            </Pressable>

            {/* Ülke seçici — dokununca ülke listesini aç/kapa */}
            <Pressable
              onPress={() => { tapH(); setCountryList((v) => !v); setCountrySearch(""); }}
              style={[styles.useLoc, { borderColor: T.hairline, backgroundColor: T.surfaceStrong, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            >
              <Text style={[Type.title, { color: T.text }]}>{country.flag} {country.tr}</Text>
              <Text style={{ color: T.primary, fontSize: 16 }}>{countryList ? "▴" : "▾"}</Text>
            </Pressable>

            {countryList ? (
              <>
                {/* Ülke ara */}
                <TextInput
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder="Ülke ara…"
                  placeholderTextColor={T.textFaint}
                  autoCorrect={false}
                  style={[Type.body, styles.citySearch, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
                />
                <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {filteredCountries.map((c) => (
                    <Pressable
                      key={c.code}
                      onPress={() => { tapH(); setCountry(c); setCountryList(false); setCountrySearch(""); }}
                      style={[styles.cityRow, { borderBottomColor: T.hairline }]}
                    >
                      <Text style={[Type.body, { color: country.code === c.code ? T.primary : T.text, fontWeight: country.code === c.code ? "800" : "500" }]}>
                        {c.flag} {c.tr}
                      </Text>
                      {country.code === c.code ? <Text style={{ color: T.primary }}>✓</Text> : null}
                    </Pressable>
                  ))}
                  {filteredCountries.length === 0 ? (
                    <Text style={[Type.body, { color: T.textFaint, textAlign: "center", paddingVertical: 16 }]}>Sonuç yok</Text>
                  ) : null}
                </ScrollView>
              </>
            ) : isTR ? (
              <>
                {/* Şehir ara (81 il) — yalnız Türkiye seçiliyken */}
                <TextInput
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder="Şehir ara…"
                  placeholderTextColor={T.textFaint}
                  autoCorrect={false}
                  style={[Type.body, styles.citySearch, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
                />

                <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {filteredCities.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => { tapH(); setCity(c); setCityModal(false); setCitySearch(""); }}
                      style={[styles.cityRow, { borderBottomColor: T.hairline }]}
                    >
                      <Text style={[Type.body, { color: city === c ? T.primary : T.text, fontWeight: city === c ? "800" : "500" }]}>
                        📍 {c}
                      </Text>
                      {city === c ? <Text style={{ color: T.primary }}>✓</Text> : null}
                    </Pressable>
                  ))}
                  {filteredCities.length === 0 ? (
                    <Text style={[Type.body, { color: T.textFaint, textAlign: "center", paddingVertical: 16 }]}>Sonuç yok</Text>
                  ) : null}
                </ScrollView>
              </>
            ) : (
              <Text style={[Type.body, { color: T.textFaint, textAlign: "center", paddingVertical: 16 }]}>
                {country.flag} {country.tr} etkinlikleri gösteriliyor
              </Text>
            )}
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
    width: 38, height: 38, borderRadius: Radius.md, alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  badge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4, alignItems: "center", justifyContent: "center", borderWidth: 1.5,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
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
  useLoc: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: Space.md,
  },
  citySearch: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: Space.sm,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
