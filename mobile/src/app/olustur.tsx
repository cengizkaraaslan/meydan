import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { AuroraBackground } from "@/components/AuroraBackground";
import { GlassCard } from "@/components/GlassCard";
import { ImageEditor } from "@/components/ImageEditor";
import { Pill, GradientButton } from "@/ui/atoms";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { CATEGORIES } from "@/lib/categories";
import { ALL_CITIES, detectCity, districtsFor } from "@/lib/location";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { getMyEvent, upsertMyEvent } from "@/lib/myEvents";
import { tapH, impactH, successH } from "@/lib/haptics";

/** Görseli 1200px genişliğe sığdırıp JPEG olarak sıkıştırır (SDK56 context API + fallback). */
export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { user } = useAuth();

  const [image, setImage] = useState<string | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null); // kırpma ekranına gidecek ham görsel
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState<string | null>(null);
  // Etkinlik tarihi+saati — native takvim/saat seçici ile.
  const [when, setWhen] = useState<Date | null>(null);
  const [picker, setPicker] = useState<null | "date" | "time">(null);
  // Oluşturan kimliğini gizle (sonradan düzenlenebilir).
  const [creatorHidden, setCreatorHidden] = useState(false);
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");

  const [published, setPublished] = useState(false);

  const [cityModal, setCityModal] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [locating, setLocating] = useState(false);

  // İlçe seçimi (#B4): seçili şehrin gerçek ilçeleri API'den çekilir.
  const [district, setDistrict] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtModal, setDistrictModal] = useState(false);
  const [districtQuery, setDistrictQuery] = useState("");
  // Düzenleme modunda, şehir set edilince ilçe effect'i sıfırlamasın diye beklemedeki ilçe.
  const pendingDistrict = useRef<string | null>(null);

  // Düzenleme modu: ?id varsa o etkinliği yükleyip alanları doldur.
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!editId;
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    getMyEvent(String(editId)).then((ev) => {
      if (!alive || !ev) return;
      setTitle(ev.title);
      setVenue(ev.venue);
      setDesc(ev.description);
      setCategory(ev.category);
      setWebsite(ev.website);
      setInstagram(ev.instagram);
      setFacebook(ev.facebook);
      setTiktok(ev.tiktok);
      setImage(ev.imageUri);
      setCreatorHidden(ev.creatorHidden ?? false);
      if (ev.startsAt) {
        const d = new Date(ev.startsAt);
        if (!isNaN(d.getTime())) setWhen(d);
      }
      pendingDistrict.current = ev.district;
      setCity(ev.city); // ilçe effect'ini tetikler → pendingDistrict uygulanır
    });
    return () => {
      alive = false;
    };
  }, [editId]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLocaleLowerCase("tr-TR");
    if (!q) return ALL_CITIES;
    return ALL_CITIES.filter((c) => c.toLocaleLowerCase("tr-TR").includes(q));
  }, [cityQuery]);

  // Şehir değişince o şehrin ilçelerini çek (API). API boş/erişilemezse yerel yedeğe düş.
  useEffect(() => {
    if (!city) {
      setDistricts([]);
      setDistrict(null);
      return;
    }
    let alive = true;
    // Düzenleme yüklemesinde beklemedeki ilçeyi koru; normal şehir değişiminde sıfırla.
    setDistrict(pendingDistrict.current);
    pendingDistrict.current = null;
    // Önce yerel veriyle anında doldur (büyük şehirler), sonra API ile güncelle.
    setDistricts(districtsFor(city));
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/districts?city=${encodeURIComponent(city)}`);
        const json = (await res.json()) as { districts?: string[] };
        const apiList = Array.isArray(json.districts) ? json.districts : [];
        if (alive) setDistricts(apiList.length > 0 ? apiList : districtsFor(city));
      } catch {
        if (alive) setDistricts(districtsFor(city));
      }
    })();
    return () => {
      alive = false;
    };
  }, [city]);

  const filteredDistricts = useMemo(() => {
    const q = districtQuery.trim().toLocaleLowerCase("tr-TR");
    if (!q) return districts;
    return districts.filter((d) => d.toLocaleLowerCase("tr-TR").includes(q));
  }, [districts, districtQuery]);

  const canPublish = title.trim().length > 0 && !!category;

  async function useMyLocation() {
    if (locating) return;
    tapH();
    setLocating(true);
    try {
      const detected = await detectCity();
      if (detected) {
        setCity(detected);
        successH();
      }
    } finally {
      setLocating(false);
    }
  }

  function selectCity(c: string) {
    tapH();
    setCity(c);
    setCityModal(false);
    setCityQuery("");
  }

  function selectDistrict(d: string | null) {
    tapH();
    setDistrict(d);
    setDistrictModal(false);
    setDistrictQuery("");
  }

  async function pickImage() {
    tapH();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (res.canceled || !res.assets?.length) return;
    // Native crop yerine kendi kırpma ekranımızı aç (profil avatarıyla aynı bileşen).
    setCropUri(res.assets[0].uri);
  }

  // Kırpma onayı → görseli ayarla (ImageCropper zaten yeniden boyutlandırıp sıkıştırır).
  function onCropped(uri: string) {
    setCropUri(null);
    setImage(uri);
  }

  const whenLabel = (d: Date) =>
    `${d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  // Takvim → saat akışı: tarih seçilince saat seçimine geç; saat seçilince kapat.
  const onPickerChange = (e: DateTimePickerEvent, sel?: Date) => {
    if (e.type === "dismissed") { setPicker(null); return; }
    const base = sel ?? when ?? new Date();
    const d = new Date(when ?? new Date());
    if (picker === "date") {
      d.setFullYear(base.getFullYear(), base.getMonth(), base.getDate());
      setWhen(d);
      setPicker("time");
    } else {
      d.setHours(base.getHours(), base.getMinutes(), 0, 0);
      setWhen(d);
      setPicker(null);
    }
  };

  async function publish() {
    if (!canPublish || published) return;
    impactH();
    // Best-effort POST — görsel upload backend'i YOK, yerel uri ya da boş gönderilir.
    try {
      await fetch(`${API_BASE}/api/v1/create-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          venue: venue.trim(),
          city: city ?? "",
          district: district ?? "",
          startsAt: (when ?? new Date()).toISOString(),
          description: desc.trim(),
          website: website.trim(),
          instagram: instagram.trim(),
          facebook: facebook.trim(),
          tiktok: tiktok.trim(),
          imageUrl: image ?? "",
          creatorEmail: user?.email ?? "",
          creatorName: creatorHidden ? "" : (user?.name ?? ""),
          creatorHidden,
        }),
      });
    } catch {
      /* yut — best-effort */
    }
    // Yerel "oluşturduğum etkinlikler" listesine kaydet (id varsa günceller).
    try {
      await upsertMyEvent({
        id: editId ? String(editId) : undefined,
        title: title.trim(),
        category,
        venue: venue.trim(),
        city,
        district,
        description: desc.trim(),
        website: website.trim(),
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        tiktok: tiktok.trim(),
        imageUri: image,
        startsAt: (when ?? new Date()).toISOString(),
        creatorName: user?.name ?? user?.email ?? "",
        creatorHidden,
      });
    } catch {
      /* yut */
    }
    successH();
    setPublished(true);
    setTimeout(() => router.back(), 1200);
  }

  const field = (
    placeholder: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { multiline?: boolean; icon?: string; keyboard?: "url" | "default" },
  ) => (
    <View
      style={[
        styles.inputWrap,
        {
          backgroundColor: T.surfaceStrong,
          borderColor: T.hairline,
          alignItems: opts?.multiline ? "flex-start" : "center",
        },
      ]}
    >
      {opts?.icon ? <Text style={{ fontSize: 16, marginTop: opts?.multiline ? 2 : 0 }}>{opts.icon}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.textFaint}
        multiline={opts?.multiline}
        keyboardType={opts?.keyboard === "url" ? "url" : "default"}
        autoCapitalize={opts?.keyboard === "url" ? "none" : "sentences"}
        style={[
          Type.body,
          {
            flex: 1,
            color: T.text,
            paddingVertical: 0,
            minHeight: opts?.multiline ? 86 : undefined,
            textAlignVertical: opts?.multiline ? "top" : "center",
          },
        ]}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Başlık + geri */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={12} style={styles.backBtn}>
            <Text style={{ fontSize: 22, color: T.text }}>‹</Text>
          </Pressable>
          <Text style={[Type.h1, { color: T.text }]}>{isEditing ? t("create_event_edit") : t("create_event")}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: Space.xl, paddingBottom: insets.bottom + 120, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Teaser / CTA kartı — gradient kenarlı, premium his */}
          <Animated.View entering={FadeIn.duration(600)}>
            <LinearGradient
              colors={T.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.ctaBorder, glow(T.primary, 22, 0.45)]}
            >
              <GlassCard glowColor="transparent" radius={Radius.lg - 1.5} intensity={32}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                  <LinearGradient
                    colors={T.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.ctaIcon, glow(T.primary, 16, 0.5)]}
                  >
                    <Text style={{ fontSize: 22 }}>✨</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={[Type.title, { color: T.text, lineHeight: 22 }]}>{t("create_cta")}</Text>
                    <Text style={[Type.label, { color: T.textDim }]}>{t("ev_examples")}</Text>
                  </View>
                </View>
              </GlassCard>
            </LinearGradient>
          </Animated.View>

          {/* Görsel */}
          <Animated.View entering={FadeInDown.duration(450).delay(60)}>
            <Pressable onPress={pickImage} style={[styles.imageBox, { borderColor: T.hairline, backgroundColor: T.surface }]}>
              {image ? (
                <>
                  <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <LinearGradient
                    colors={["transparent", "rgba(8,7,13,0.85)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.changeBadge}>
                    <Text style={[Type.label, { color: "#fff" }]}>📷 {t("ev_change_image")}</Text>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: "center", gap: 8 }}>
                  <LinearGradient
                    colors={T.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.imageIcon, glow(T.primary, 18, 0.5)]}
                  >
                    <Text style={{ fontSize: 26 }}>🖼️</Text>
                  </LinearGradient>
                  <Text style={[Type.title, { color: T.text }]}>{t("ev_add_image")}</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Temel alanlar */}
          <Animated.View entering={FadeInDown.duration(450).delay(120)} style={{ gap: 12 }}>
            {field(t("ev_title"), title, setTitle, { icon: "🎫" })}
            {field(t("ev_venue"), venue, setVenue, { icon: "📍" })}
            {/* Tarih & saat — native takvim/saat seçici */}
            <Pressable
              onPress={() => { tapH(); setPicker("date"); }}
              style={[styles.inputWrap, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, alignItems: "center" }]}
            >
              <Text style={{ fontSize: 16 }}>🗓️</Text>
              <Text style={[Type.body, { flex: 1, color: when ? T.text : T.textFaint, marginLeft: 10 }]}>
                {when ? whenLabel(when) : "Tarih & saat seç"}
              </Text>
              <Text style={{ color: T.textDim }}>▾</Text>
            </Pressable>
          </Animated.View>

          {picker ? (
            <DateTimePicker
              value={when ?? new Date()}
              mode={picker}
              is24Hour
              onChange={onPickerChange}
            />
          ) : null}

          {/* Oluşturan + kimlik gizleme */}
          <Animated.View entering={FadeInDown.duration(450).delay(140)} style={{ gap: 8 }}>
            <Text style={[Type.label, { color: T.textDim }]}>Oluşturan</Text>
            <View style={[styles.creatorRow, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={[Type.body, { color: T.text, flex: 1 }]} numberOfLines={1}>
                {creatorHidden ? "🔒 Gizli (Anonim)" : (user?.name ?? user?.email ?? "Sen")}
              </Text>
              <Switch
                value={creatorHidden}
                onValueChange={(v) => { impactH(); setCreatorHidden(v); }}
                trackColor={{ false: T.hairline, true: T.primary }}
              />
            </View>
            <Text style={[Type.micro, { color: T.textFaint }]}>
              Kimliğimi gizli tut — açarsan adın etkinlikte görünmez (sonradan düzenleyebilirsin).
            </Text>
          </Animated.View>

          {/* Şehir */}
          <Animated.View entering={FadeInDown.duration(450).delay(160)}>
            <Text style={[Type.label, { color: T.textDim, marginBottom: 10 }]}>{t("ev_city")}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Konumum butonu */}
              <Pressable
                onPress={useMyLocation}
                disabled={locating}
                style={[
                  styles.locBtn,
                  { backgroundColor: T.surfaceStrong, borderColor: T.hairline, opacity: locating ? 0.7 : 1 },
                ]}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={T.primary} />
                ) : (
                  <Text style={{ fontSize: 16 }}>📍</Text>
                )}
                <Text style={[Type.label, { color: T.text }]} numberOfLines={1}>
                  {locating ? t("locating") : t("use_my_location")}
                </Text>
              </Pressable>

              {/* Şehir seç alanı → modal */}
              <Pressable
                onPress={() => { tapH(); setCityModal(true); }}
                style={[styles.citySelect, { backgroundColor: T.surfaceStrong, borderColor: city ? T.primary : T.hairline }]}
              >
                <Text style={[Type.body, { color: city ? T.text : T.textFaint, flex: 1 }]} numberOfLines={1}>
                  {city ?? t("select_city")}
                </Text>
                <Text style={{ fontSize: 12, color: T.textDim }}>▾</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* İlçe (#B4) — yalnızca şehir seçili ve ilçe verisi varsa görünür */}
          {city && districts.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(450).delay(180)}>
              <Text style={[Type.label, { color: T.textDim, marginBottom: 10 }]}>{t("district")}</Text>
              <Pressable
                onPress={() => { tapH(); setDistrictModal(true); }}
                style={[styles.citySelect, { backgroundColor: T.surfaceStrong, borderColor: district ? T.primary : T.hairline }]}
              >
                <Text style={[Type.body, { color: district ? T.text : T.textFaint, flex: 1 }]} numberOfLines={1}>
                  {district ?? t("all_districts")}
                </Text>
                <Text style={{ fontSize: 12, color: T.textDim }}>▾</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Kategori */}
          <Animated.View entering={FadeInDown.duration(450).delay(200)}>
            <Text style={[Type.label, { color: T.textDim, marginBottom: 10 }]}>{t("ev_category")}</Text>
            <View style={styles.pillWrap}>
              {CATEGORIES.map((c) => (
                <Pill
                  key={c.key}
                  label={`${c.emoji} ${c.label}`}
                  active={category === c.key}
                  gradient={c.gradient}
                  onPress={() => setCategory(category === c.key ? null : c.key)}
                />
              ))}
            </View>
          </Animated.View>

          {/* Açıklama */}
          <Animated.View entering={FadeInDown.duration(450).delay(240)}>
            {field(t("ev_desc"), desc, setDesc, { multiline: true, icon: "📝" })}
          </Animated.View>

          {/* Sosyal */}
          <Animated.View entering={FadeInDown.duration(450).delay(280)} style={{ gap: 12 }}>
            {field(t("ev_website"), website, setWebsite, { icon: "🌐", keyboard: "url" })}
            {field(t("ev_instagram"), instagram, setInstagram, { icon: "📸", keyboard: "url" })}
            {field(t("ev_facebook"), facebook, setFacebook, { icon: "👍", keyboard: "url" })}
            {field(t("ev_tiktok"), tiktok, setTiktok, { icon: "🎵", keyboard: "url" })}
          </Animated.View>

          {/* Yayınla */}
          <Animated.View entering={FadeInDown.duration(450).delay(320)} style={{ marginTop: 4 }}>
            {published ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <GlassCard glowColor={T.success}>
                  <View style={{ alignItems: "center", gap: 6, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 32 }}>🎉</Text>
                    <Text style={[Type.title, { color: T.success, textAlign: "center" }]}>{t("ev_published")}</Text>
                  </View>
                </GlassCard>
              </Animated.View>
            ) : (
              <View style={canPublish ? glow(T.primary, 20, 0.5) : undefined}>
                <View style={!canPublish ? { opacity: 0.5 } : undefined} pointerEvents={canPublish ? "auto" : "none"}>
                  <GradientButton label={t("ev_publish")} icon="✨" onPress={publish} />
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Şehir seçimi modalı — arama kutulu combobox */}
      <Modal
        visible={cityModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setCityModal(false); setCityQuery(""); }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => { setCityModal(false); setCityQuery(""); }}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: T.bg, borderColor: T.hairline, paddingBottom: insets.bottom + 16, maxHeight: "78%" },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={[Type.h2, { color: T.text, marginBottom: 12 }]}>{t("select_city")}</Text>

            <View style={[styles.inputWrap, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, alignItems: "center", marginBottom: 14 }]}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <TextInput
                value={cityQuery}
                onChangeText={setCityQuery}
                placeholder={t("select_city")}
                placeholderTextColor={T.textFaint}
                autoFocus
                style={[Type.body, { flex: 1, color: T.text, paddingVertical: 0 }]}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filteredCities.map((c) => {
                const active = city === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => selectCity(c)}
                    style={[styles.cityRow, { borderBottomColor: T.hairline }]}
                  >
                    <Text style={[Type.body, { color: active ? T.primary : T.text, flex: 1 }]}>{c}</Text>
                    {active ? <Text style={{ fontSize: 14, color: T.primary }}>✓</Text> : null}
                  </Pressable>
                );
              })}
              {filteredCities.length === 0 ? (
                <Text style={[Type.label, { color: T.textFaint, textAlign: "center", paddingVertical: 24 }]}>
                  {t("search_empty")}
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* İlçe seçimi modalı — arama kutulu combobox */}
      <Modal
        visible={districtModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setDistrictModal(false); setDistrictQuery(""); }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => { setDistrictModal(false); setDistrictQuery(""); }}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: T.bg, borderColor: T.hairline, paddingBottom: insets.bottom + 16, maxHeight: "78%" },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <Text style={[Type.h2, { color: T.text, marginBottom: 12 }]}>{t("district")}</Text>

            <View style={[styles.inputWrap, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, alignItems: "center", marginBottom: 14 }]}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <TextInput
                value={districtQuery}
                onChangeText={setDistrictQuery}
                placeholder={t("district")}
                placeholderTextColor={T.textFaint}
                autoFocus
                style={[Type.body, { flex: 1, color: T.text, paddingVertical: 0 }]}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Tüm ilçeler = ilçe seçilmedi */}
              <Pressable
                onPress={() => selectDistrict(null)}
                style={[styles.cityRow, { borderBottomColor: T.hairline }]}
              >
                <Text style={[Type.body, { color: district === null ? T.primary : T.text, flex: 1 }]}>{t("all_districts")}</Text>
                {district === null ? <Text style={{ fontSize: 14, color: T.primary }}>✓</Text> : null}
              </Pressable>
              {filteredDistricts.map((d) => {
                const active = district === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => selectDistrict(d)}
                    style={[styles.cityRow, { borderBottomColor: T.hairline }]}
                  >
                    <Text style={[Type.body, { color: active ? T.primary : T.text, flex: 1 }]}>{d}</Text>
                    {active ? <Text style={{ fontSize: 14, color: T.primary }}>✓</Text> : null}
                  </Pressable>
                );
              })}
              {filteredDistricts.length === 0 ? (
                <Text style={[Type.label, { color: T.textFaint, textAlign: "center", paddingVertical: 24 }]}>
                  {t("search_empty")}
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Etkinlik görseli kırpma ekranı (4:5 dikey afiş) */}
      <ImageEditor uri={cropUri} aspect={4 / 5} outWidth={1080} title={t("ev_add_image")} onDone={onCropped} onCancel={() => setCropUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.xl,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flexDirection: "row",
    gap: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  imageBox: {
    height: 190,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imageIcon: {
    width: 58,
    height: 58,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  changeBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ctaBorder: {
    borderRadius: Radius.lg,
    padding: 1.5,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  locBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  citySelect: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Space.xl,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 14,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
