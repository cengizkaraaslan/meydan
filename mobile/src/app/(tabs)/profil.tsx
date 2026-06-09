import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AuroraBackground } from "@/components/AuroraBackground";
import { DatingProfileFields } from "@/components/DatingProfileFields";
import { EventRow } from "@/components/EventCard";
import { ImageEditor } from "@/components/ImageEditor";
import { deleteLocalFile } from "@/lib/fileStore";
import { StoryAvatar } from "@/components/StoryAvatar";
import { EventStoryViewer, type StoryGroup } from "@/components/EventStoryViewer";
import { resolveAvatar } from "@/lib/avatar";
import { Pill, SectionHeader } from "@/ui/atoms";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useFavorites } from "@/lib/favorites";
import { useAttending } from "@/lib/attending";
import { useStories, addStory, type Story } from "@/lib/stories";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/admin";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { showAuthPrompt } from "@/lib/authPrompt";
import { syncProfile, onAvatarRestored } from "@/lib/profileSync";
import { uploadImage } from "@/lib/social";
import { useDProfile, ageFromBirthDate } from "@/lib/dprofile";
import { useActiveCity, ALL_CITIES, districtsFor } from "@/lib/location";
import { tapH, impactH, successH } from "@/lib/haptics";

/** Tek istatistik kartı — büyük rakam + altında etiket. Dokununca ilgili liste açılır. */
function StatCard({ value, label, color, T, onPress }: { value: string; label: string; color: string; T: Palette; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statCard, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, opacity: pressed ? 0.65 : 1 }]}
    >
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[Type.label, { color: T.textFaint, marginTop: 8, textAlign: "center" }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Girilebilecek sosyal hesaplar. */
const SOCIALS: { key: string; label: string; icon: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", icon: "📸", placeholder: "Instagram kullanıcı adın (örn. @kullanici)" },
  { key: "tiktok", label: "TikTok", icon: "🎵", placeholder: "TikTok kullanıcı adın (örn. @kullanici)" },
  { key: "facebook", label: "Facebook", icon: "📘", placeholder: "Facebook profil adın veya linkin" },
];

interface SocialEntry {
  handle: string;
  pub: boolean;
}
type SocialMap = Record<string, SocialEntry>;
const EMPTY_SOCIAL: SocialMap = {
  instagram: { handle: "", pub: false },
  tiktok: { handle: "", pub: false },
  facebook: { handle: "", pub: false },
};

/** Boş bölüm yer tutucusu — düz metin yerine sade kart (tasarımı toparlar). */
function EmptyMini({ emoji, text, T }: { emoji: string; text: string; T: Palette }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text style={[Type.body, { color: T.textFaint, textAlign: "center" }]}>{text}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { user, signInWithGoogle, configured } = useAuth();
  const { admin: isUserAdmin } = useIsAdmin();
  const { list: favs } = useFavorites();
  const { upcoming, past } = useAttending();
  const { stories, remove, reload, editCaption } = useStories();
  // Açık story grubu (EventStoryViewer için indeks); null = kapalı.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // Story başlığı (caption) düzenleme — thumbnail'a uzun basınca açılır.
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [listView, setListView] = useState<null | "upcoming" | "past" | "fav">(null);
  const [socialOpen, setSocialOpen] = useState(false);
  // "Başkalarının gözünden profilim" — public önizleme modalı.
  const [previewOpen, setPreviewOpen] = useState(false);

  // Sosyal hesaplar (yerelde saklanır; görünürlük toggle'lı).
  const [social, setSocial] = useState<SocialMap>(EMPTY_SOCIAL);
  useEffect(() => {
    AsyncStorage.getItem("meydanfest:social").then((raw) => {
      if (raw) {
        try {
          setSocial({ ...EMPTY_SOCIAL, ...(JSON.parse(raw) as SocialMap) });
        } catch {
          /* yoksay */
        }
      }
    });
  }, []);
  const saveSocial = (next: SocialMap) => {
    setSocial(next);
    AsyncStorage.setItem("meydanfest:social", JSON.stringify(next));
  };

  // Basit toast bildirimi (alt kısımda kayan).
  const [toast, setToast] = useState<string | null>(null);
  const toastO = useSharedValue(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    toastO.value = withTiming(1, { duration: 200 });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      toastO.value = withTiming(0, { duration: 250 });
    }, 2200);
  };
  const toastStyle = useAnimatedStyle(() => ({ opacity: toastO.value }));

  // Tanışma profilini (değişince, debounce'lı) backend'e senkronla → DB'de dolu olsun.
  const { profile: dprof } = useDProfile();
  const dprofTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (dprofTimer.current) clearTimeout(dprofTimer.current);
    dprofTimer.current = setTimeout(() => {
      void syncProfile({
        bio: dprof.about,
        birthDate: dprof.birthDate || null,
        showAge: dprof.showAge,
        heightCm: dprof.heightCm,
        weightKg: dprof.weightKg,
        interests: dprof.interests.join(","),
        goal: dprof.goal,
        languages: dprof.languages.join(","),
        zodiac: dprof.zodiac,
        education: dprof.education,
        drinking: dprof.drinking,
        smoking: dprof.smoking,
        exercise: dprof.exercise,
      });
    }, 900);
    return () => {
      if (dprofTimer.current) clearTimeout(dprofTimer.current);
    };
  }, [dprof]);

  const toggleSocial = (key: string, label: string) => {
    impactH();
    const next = { ...social, [key]: { ...social[key], pub: !social[key].pub } };
    saveSocial(next);
    showToast(next[key].pub ? `${label} artık herkese açık 👀` : `${label} gizlendi 🔒`);
  };

  // Profil değişiklikleri zaten anında yerelde + debounce'lı senkron; bu buton hemen
  // sunucuya yazar ve net "kaydedildi" geri bildirimi verir.
  const saveProfile = () => {
    impactH();
    void syncProfile({
      bio: dprof.about,
      birthDate: dprof.birthDate || null,
      showAge: dprof.showAge,
      heightCm: dprof.heightCm,
      weightKg: dprof.weightKg,
      interests: dprof.interests.join(","),
      goal: dprof.goal,
      languages: dprof.languages.join(","),
      zodiac: dprof.zodiac,
      education: dprof.education,
      drinking: dprof.drinking,
      smoking: dprof.smoking,
      exercise: dprof.exercise,
    });
    successH();
    showToast("Profil kaydedildi ✓");
  };

  // Profil fotoğrafı — kullanıcı kendi seçtiği görseli ayarlayabilir (yerelde + DB'ye senkron).
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null); // kırpma ekranına gidecek ham görsel
  const [gender, setGender] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem("meydanfest:avatar").then(setAvatarOverride);
    AsyncStorage.getItem("meydanfest:gender").then(setGender);
  }, []);
  // Girişte sunucudan avatar geri yüklenince (reinstall sonrası) anında uygula.
  useEffect(() => onAvatarRestored(setAvatarOverride), []);
  const photoUri = avatarOverride ?? user?.photo;

  // Galeriden seç → kırpma ekranını aç (native crop değil, kendi ImageCropper'ımız).
  const changePhoto = async () => {
    impactH();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    setCropUri(res.assets[0].uri);
  };

  // Düzenleme onayı → önce yerel önizleme, sonra R2'ye YÜKLE → public URL'i kaydet + DB'ye senkron.
  const saveAvatar = (uri: string) => {
    const prev = avatarOverride;
    setCropUri(null);
    setAvatarOverride(uri); // hızlı önizleme (yerel)
    AsyncStorage.setItem("meydanfest:avatar", uri);
    void (async () => {
      // Yerel görseli sunucuya (R2) yükle → public URL. Başarısızsa yerelde kalır.
      const url = await uploadImage(uri, "post");
      if (url) {
        setAvatarOverride(url);
        AsyncStorage.setItem("meydanfest:avatar", url);
        syncProfile({ avatar: url }); // DB'ye GERÇEK URL gider
        if (prev && prev !== url) deleteLocalFile(prev);
      } else {
        // Yükleme olmadıysa en azından yerel yolu senkronla (eski davranış).
        syncProfile({ avatar: uri });
        showToast("Avatar yüklenemedi (çevrimdışı?) — yerelde kayıtlı");
        if (prev && prev !== uri) deleteLocalFile(prev);
      }
    })();
  };

  // ── 📍 Konum: şehir/ilçe dropdown + gerçek koordinat ──
  const { city, setCity } = useActiveCity();
  const [district, setDistrict] = useState<string | null>(null);
  const [cityModal, setCityModal] = useState(false);
  const [districtModal, setDistrictModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [coordsLoading, setCoordsLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("meydanfest:district").then(setDistrict);
  }, []);

  // Seçili şehrin ilçe listesi (yerel yedek; şehir yoksa boş).
  const districts = useMemo(() => districtsFor(city), [city]);

  // Şehir araması (Türkçe karakter duyarsız basit filtre).
  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLocaleLowerCase("tr-TR");
    if (!q) return ALL_CITIES;
    return ALL_CITIES.filter((c) => c.toLocaleLowerCase("tr-TR").includes(q));
  }, [citySearch]);

  const pickCity = (c: string) => {
    tapH();
    setCityModal(false);
    setCitySearch("");
    setCity(c); // useActiveCity → setManualCity (uygulamanın geri kalanı bunu kullanır)
    // Şehir değişince ilçe sıfırlanır.
    setDistrict(null);
    AsyncStorage.removeItem("meydanfest:district");
    syncProfile({ city: c, district: null });
  };

  const pickDistrict = (d: string | null) => {
    tapH();
    setDistrictModal(false);
    setDistrict(d);
    if (d) AsyncStorage.setItem("meydanfest:district", d);
    else AsyncStorage.removeItem("meydanfest:district");
    syncProfile({ district: d });
  };

  // Tam koordinatı al → yerelde sakla + backend'e gönder.
  const captureCoords = async () => {
    if (coordsLoading) return;
    impactH();
    setCoordsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Konum izni gerekli", "Tam konumunu kaydetmek için konum iznini açman gerekiyor.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      await AsyncStorage.setItem("meydanfest:coords", JSON.stringify({ lat, lng, ts: Date.now() }));
      syncProfile({ lat, lng });
      successH();
      showToast("Konumun kaydedildi 📍");
    } catch {
      Alert.alert("Konum alınamadı", "Konum servisi kapalı olabilir. Lütfen tekrar dene.");
    } finally {
      setCoordsLoading(false);
    }
  };

  // Story paylaş — oturum + medya izni gerekir.
  const shareStory = async () => {
    if (!user) {
      showAuthPrompt(t("lock_story_title"));
      return;
    }
    impactH();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.length) return;
    await addStory({ uri: res.assets[0].uri, caption: "", eventSlug: "", ts: Date.now() });
    reload();
    successH();
  };

  const myAvatar = resolveAvatar(photoUri, user?.name, gender);

  // Story'leri ETKİNLİĞE göre grupla: aynı eventSlug → tek story (çok segment, yan yana).
  // eventSlug boş (profilden doğrudan paylaşılan) → her biri kendi grubu.
  const storyGroups = useMemo<Story[][]>(() => {
    const map = new Map<string, Story[]>();
    const order: string[] = [];
    for (const s of stories) {
      const key = s.eventSlug ? `e:${s.eventSlug}` : `s:${s.ts}`;
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(s);
    }
    return order.map((k) => map.get(k)!);
  }, [stories]);

  // EventStoryViewer için gruplar (çok segment + ⋯ Sil + etkinlik etiketi).
  const viewerGroups = useMemo<StoryGroup[]>(
    () =>
      storyGroups.map((grp) => ({
        id: grp[0].eventSlug || `me-${grp[0].ts}`,
        name: grp[0].eventTitle?.trim() || user?.name || "Story'n",
        avatar: myAvatar,
        isMe: true,
        segments: grp.map((s) => ({
          uri: s.uri,
          caption: s.caption || undefined,
          eventTitle: s.eventTitle,
          city: s.city,
        })),
      })),
    [storyGroups, user?.name, myAvatar],
  );

  // Story başlığı düzenleme modalını aç — mevcut caption draft'a yüklenir.
  const openCaptionEditor = (s: Story) => {
    impactH();
    setEditingStory(s);
    setCaptionDraft(s.caption ?? "");
  };

  // Kaydet → reaktif editCaption (yerel + backend), modal kapanır. Boş başlık serbest.
  const saveCaption = async () => {
    if (!editingStory) return;
    const s = editingStory;
    setEditingStory(null);
    await editCaption(s.ts, captionDraft.trim());
    successH();
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 160, paddingHorizontal: 16 }}>
        {/* Üst bar — sol 👁️ önizleme · başlık · sağ ⚙️ ayarlar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => { tapH(); setPreviewOpen(true); }} hitSlop={10} style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={{ fontSize: 18 }}>👁️</Text>
          </Pressable>
          <Text style={[Type.h2, { color: T.text, flex: 1, textAlign: "center" }]}>{t("tab_profile")}</Text>
          <Pressable onPress={() => { tapH(); router.push("/ayarlar"); }} hitSlop={10} style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </Pressable>
        </View>

        {/* Profil başlığı */}
        <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
          <Pressable onPress={changePhoto} style={styles.avatarWrap}>
            {/* Story yüklediyse avatarda Instagram-tarzı halka (StoryAvatar) */}
            <StoryAvatar uri={resolveAvatar(photoUri, user?.name, gender)} name={user?.name ?? "✦"} size={84} hasStory={stories.length > 0} />
            {/* Düzenle rozeti — fotoğrafı değiştir */}
            <View style={[styles.avatarEdit, { backgroundColor: T.primary, borderColor: T.bg }]}>
              <Text style={{ fontSize: 13 }}>📷</Text>
            </View>
          </Pressable>
          <Text style={[Type.h1, { color: T.text, marginTop: Space.md }]}>{user ? user.name : t("guest")}</Text>
          <Text style={[Type.label, { color: T.textFaint, marginTop: 4 }]}>{user?.email || t("exploring")}</Text>
        </Animated.View>

        {/* Story halkası — paylaş + görüntüle */}
        <Animated.View entering={FadeInDown.duration(450).delay(40)} style={{ marginBottom: Space.xl }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md, paddingVertical: 2 }}>
            {/* Story paylaş */}
            <Pressable onPress={shareStory} style={styles.storyItem}>
              <View style={[styles.storyAdd, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
                <Text style={{ fontSize: 26, color: T.primary }}>＋</Text>
              </View>
              <Text style={[Type.micro, { color: T.textDim, maxWidth: 64, textAlign: "center" }]} numberOfLines={1}>{t("share_story")}</Text>
            </Pressable>
            {/* Story'ler — etkinliğe göre gruplu. Etiket = ETKİNLİK ADI (yoksa başlık). */}
            {storyGroups.map((grp, gi) => {
              const head = grp[0];
              const label = head.eventTitle?.trim() || head.caption?.trim() || "Story";
              // Yeniden adlandırma yalnızca etkinliğe bağlı OLMAYAN tek story için (etiket caption olur).
              const canRename = grp.length === 1 && !head.eventTitle;
              return (
                <Pressable
                  key={head.ts}
                  onPress={() => { tapH(); setViewerIndex(gi); }}
                  onLongPress={canRename ? () => openCaptionEditor(head) : undefined}
                  delayLongPress={350}
                  style={styles.storyItem}
                >
                  <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storyRing}>
                    <Image source={{ uri: head.uri }} style={[styles.storyThumb, { borderColor: T.bg }]} contentFit="cover" transition={200} />
                  </LinearGradient>
                  {grp.length > 1 ? (
                    <View style={[styles.storyCount, { backgroundColor: T.primary, borderColor: T.bg }]}>
                      <Text style={styles.storyCountTxt}>{grp.length}</Text>
                    </View>
                  ) : null}
                  <Text style={[Type.micro, { color: T.textDim, maxWidth: 64, textAlign: "center" }]} numberOfLines={1}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Oturumsuzken Google girişi */}
        {!user && (
          <Animated.View entering={FadeInDown.duration(450).delay(60)} style={{ marginBottom: Space.xl }}>
            <Pressable onPress={() => { impactH(); signInWithGoogle(); }} disabled={!configured} style={[styles.googleBtn, !configured && { opacity: 0.5 }]}>
              <Text style={styles.googleG}>G</Text>
              <Text style={[Type.title, { color: "#1F1F1F" }]}>{t("signin_google")}</Text>
            </Pressable>
            {!configured && <Text style={[Type.label, { color: T.textFaint, textAlign: "center", marginTop: Space.sm }]}>{t("google_pending")}</Text>}
          </Animated.View>
        )}

        {/* İstatistik — yan yana stat kartları (her kart kendi yüzeyinde, rakam tam görünür) */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.statsRow}>
          <StatCard T={T} value={String(upcoming.length)} label={t("my_upcoming")} color={T.cyan} onPress={() => { tapH(); setListView("upcoming"); }} />
          <StatCard T={T} value={String(past.length)} label={t("my_past")} color={T.gold} onPress={() => { tapH(); setListView("past"); }} />
          <StatCard T={T} value={String(favs.length)} label={t("tab_favorites")} color={T.pink} onPress={() => { tapH(); setListView("fav"); }} />
        </Animated.View>

        {/* Yönetim — sadece admin */}
        {isUserAdmin && (
          <Animated.View entering={FadeInDown.duration(450).delay(100)}>
            <Pressable
              onPress={() => { tapH(); router.push("/admin"); }}
              style={({ pressed }) => [styles.adminCard, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.adminRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Space.md, flex: 1 }}>
                  <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.adminIcon, glow(T.primary, 14, 0.5)]}>
                    <Text style={{ fontSize: 18 }}>🛡️</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.title, { color: T.text }]}>{t("admin_panel")}</Text>
                    <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>{t("admin_users")}</Text>
                  </View>
                </View>
                <Text style={[Type.h2, { color: T.gold }]}>→</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Profil bilgileri — tanışma alanları (hakkımda, yaş, ilgi alanları, ...) */}
        <Animated.View entering={FadeInDown.duration(450).delay(105)} style={{ marginBottom: Space.md }}>
          <DatingProfileFields />
        </Animated.View>

        {/* Profilimi Kaydet — değişiklikler otomatik kaydolur, bu buton anında senkronlar */}
        <Pressable onPress={saveProfile} style={{ marginBottom: Space.xl, borderRadius: Radius.pill, overflow: "hidden" }}>
          <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
            <Text style={[Type.title, { color: "#fff" }]}>💾 Profilimi Kaydet</Text>
          </LinearGradient>
        </Pressable>

        {/* 📍 Konum — şehir/ilçe dropdown + gerçek koordinat */}
        <Animated.View entering={FadeInDown.duration(450).delay(110)} style={{ marginBottom: Space.xl }}>
          <SectionHeader title="📍 Konum" accent={T.blue} />
          <View style={[styles.locCard, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            {/* Şehir dropdown */}
            <Pressable onPress={() => { tapH(); setCityModal(true); }} style={[styles.locRow, { borderColor: T.hairline }]}>
              <Text style={[Type.body, { color: T.textDim }]}>Şehir</Text>
              <View style={styles.locVal}>
                <Text style={[Type.title, { color: city ? T.text : T.textFaint }]}>{city ?? "Seç"}</Text>
                <Text style={[Type.title, { color: T.textFaint }]}>▾</Text>
              </View>
            </Pressable>

            {/* İlçe dropdown (opsiyonel) — şehir seçili değilse pasif */}
            <Pressable
              onPress={() => { if (!city) return; tapH(); setDistrictModal(true); }}
              disabled={!city}
              style={[styles.locRow, { borderColor: T.hairline, opacity: city ? 1 : 0.45 }]}
            >
              <Text style={[Type.body, { color: T.textDim }]}>İlçe (opsiyonel)</Text>
              <View style={styles.locVal}>
                <Text style={[Type.title, { color: district ? T.text : T.textFaint }]}>{district ?? "Seç"}</Text>
                <Text style={[Type.title, { color: T.textFaint }]}>▾</Text>
              </View>
            </Pressable>

            {/* Tam konumu kaydet */}
            <Pressable onPress={captureCoords} disabled={coordsLoading} style={{ marginTop: Space.md }}>
              <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.locBtn, coordsLoading && { opacity: 0.6 }]}>
                <Text style={[Type.title, { color: "#fff" }]}>{coordsLoading ? "Konum alınıyor…" : "📍 Tam konumumu kaydet"}</Text>
              </LinearGradient>
            </Pressable>
            <Text style={[Type.label, { color: T.textFaint, marginTop: Space.sm }]}>
              Konumunu kaydedersen yakınındaki etkinlikleri daha iyi gösterebiliriz.
            </Text>
          </View>
        </Animated.View>

        {/* Sosyal hesaplar — kompakt; "Ekle" ile kutucuklar açılır */}
        <Animated.View entering={FadeInDown.duration(450).delay(115)} style={{ marginBottom: Space.xl }}>
          <View style={styles.socialHead}>
            <View style={{ flex: 1 }}>
              <SectionHeader title={t("social_title")} accent={T.pink} />
            </View>
            <Pressable onPress={() => { tapH(); setSocialOpen((v) => !v); }} hitSlop={8} style={[styles.socialToggle, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
              <Text style={[Type.label, { color: T.primary }]}>{socialOpen ? t("hide") : `＋ ${t("add")}`}</Text>
            </Pressable>
          </View>
          {socialOpen ? (
            <>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.md }]}>{t("social_desc")}</Text>
              {SOCIALS.map((s) => (
                <View key={s.key} style={[styles.socialRow, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                  <View style={styles.socialTop}>
                    <Text style={{ fontSize: 18 }}>{s.icon}</Text>
                    <TextInput
                      value={social[s.key].handle}
                      onChangeText={(txt) => saveSocial({ ...social, [s.key]: { ...social[s.key], handle: txt } })}
                      placeholder={s.placeholder}
                      placeholderTextColor={T.textFaint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[Type.body, styles.socialInput, { color: T.text }]}
                    />
                  </View>
                  <View style={[styles.socialBottom, { borderTopColor: T.hairline }]}>
                    <Text style={[Type.label, { color: social[s.key].pub ? T.success : T.textFaint, flex: 1 }]}>
                      {social[s.key].pub ? t("social_visible") : t("social_hidden")}
                    </Text>
                    <Switch
                      value={social[s.key].pub}
                      onValueChange={() => toggleSocial(s.key, s.label)}
                      trackColor={{ false: T.hairline, true: T.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              ))}
            </>
          ) : (
            <Text style={[Type.label, { color: T.textFaint }]}>
              {SOCIALS.filter((s) => social[s.key].handle.trim()).map((s) => s.label).join(" · ") || t("social_none")}
            </Text>
          )}
        </Animated.View>

        {/* İpucu: yukarıdaki sayaç kartlarına dokununca ilgili liste açılır. */}
        <Text style={[Type.label, { color: T.textFaint, textAlign: "center" }]}>
          {t("tap_stat_hint")}
        </Text>
      </ScrollView>

      {/* Sayaç listesi (favori / katılacağım / katıldığım) — karta tıklayınca açılır */}
      <Modal visible={!!listView} transparent animationType="slide" onRequestClose={() => setListView(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setListView(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: T.hairline }]} />
            <Text style={[Type.h2, { color: T.text, marginBottom: 14 }]}>
              {listView === "fav" ? t("tab_favorites") : listView === "past" ? t("my_past") : t("my_upcoming")}
            </Text>
            {(() => {
              const data = listView === "fav" ? favs : listView === "past" ? past.map((it) => it.event) : upcoming.map((it) => it.event);
              if (!data.length) {
                return <EmptyMini emoji={listView === "fav" ? "❤️" : listView === "past" ? "🎟️" : "🗓️"} text={t("no_events_yet")} T={T} />;
              }
              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm, paddingBottom: 8 }}>
                  {data.map((e) => <EventRow key={e.id} event={e} />)}
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Story izleyici — EventStoryViewer (çok segment yan yana, etkinlik etiketi, ⋯ → Sil) */}
      {viewerIndex !== null && viewerGroups[viewerIndex] ? (
        <EventStoryViewer
          groups={viewerGroups}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onDeleteSegment={(gi, si) => {
            // (grup, segment) → ilgili story'nin ts'iyle kalıcı sil, şeridi yenile, kapat.
            const target = storyGroups[gi]?.[si];
            if (target) void remove(target.ts);
            reload();
            setViewerIndex(null);
            successH();
          }}
        />
      ) : null}

      {/* Story başlığı (caption) düzenleme — thumbnail'a uzun basınca */}
      <Modal visible={!!editingStory} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditingStory(null)}>
        <Pressable style={styles.editBackdrop} onPress={() => setEditingStory(null)}>
          <Pressable
            style={[styles.editCard, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[Type.h2, { color: T.text, marginBottom: Space.md }]}>Story başlığını düzenle</Text>
            <TextInput
              value={captionDraft}
              onChangeText={setCaptionDraft}
              placeholder="Story başlığı (örn. konum/etkinlik)"
              placeholderTextColor={T.textFaint}
              autoFocus
              style={[Type.body, styles.editInput, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
            />
            <View style={styles.editActions}>
              <Pill label="İptal" onPress={() => setEditingStory(null)} />
              <Pill label="Kaydet" gradient={T.primarySoft} onPress={saveCaption} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Şehir seçimi (aranabilir 81 il) */}
      <Modal visible={cityModal} transparent animationType="slide" onRequestClose={() => setCityModal(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCityModal(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: T.hairline }]} />
            <Text style={[Type.h2, { color: T.text, marginBottom: 12 }]}>Şehir seç</Text>
            <TextInput
              value={citySearch}
              onChangeText={setCitySearch}
              placeholder="Şehir ara…"
              placeholderTextColor={T.textFaint}
              autoCorrect={false}
              style={[Type.body, styles.citySearch, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
            />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {filteredCities.map((c) => (
                <Pressable key={c} onPress={() => pickCity(c)} style={[styles.optRow, { borderColor: T.hairline }]}>
                  <Text style={[Type.title, { color: city === c ? T.primary : T.text }]}>{c}</Text>
                  {city === c ? <Text style={[Type.title, { color: T.primary }]}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* İlçe seçimi (opsiyonel) */}
      <Modal visible={districtModal} transparent animationType="slide" onRequestClose={() => setDistrictModal(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setDistrictModal(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: T.hairline }]} />
            <Text style={[Type.h2, { color: T.text, marginBottom: 12 }]}>İlçe seç ({city})</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <Pressable onPress={() => pickDistrict(null)} style={[styles.optRow, { borderColor: T.hairline }]}>
                <Text style={[Type.title, { color: district === null ? T.primary : T.textDim }]}>Seçme / Temizle</Text>
                {district === null ? <Text style={[Type.title, { color: T.primary }]}>✓</Text> : null}
              </Pressable>
              {districts.length === 0 ? (
                <Text style={[Type.label, { color: T.textFaint, paddingVertical: Space.md }]}>Bu şehir için ilçe listesi yok.</Text>
              ) : (
                districts.map((d) => (
                  <Pressable key={d} onPress={() => pickDistrict(d)} style={[styles.optRow, { borderColor: T.hairline }]}>
                    <Text style={[Type.title, { color: district === d ? T.primary : T.text }]}>{d}</Text>
                    {district === d ? <Text style={[Type.title, { color: T.primary }]}>✓</Text> : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 👁️ Başkalarının gözünden profilim — public, salt-okunur önizleme */}
      <Modal visible={previewOpen} animationType="slide" statusBarTranslucent onRequestClose={() => setPreviewOpen(false)}>
        <View style={[styles.previewRoot, { backgroundColor: T.bg }]}>
          <AuroraBackground />
          {(() => {
            // Sadece HERKESE AÇIK (pub=true) ve handle dolu sosyal hesaplar.
            const publicSocials = SOCIALS.filter((s) => social[s.key]?.pub && social[s.key].handle.trim());
            // Yaş: yalnızca showAge true ise göster (birthDate'ten, yoksa basit age girişinden).
            const previewAge = dprof.showAge
              ? (ageFromBirthDate(dprof.birthDate) ?? (dprof.age.trim() ? Number(dprof.age) : null))
              : null;
            const interests = dprof.interests.filter((i) => i.trim());
            return (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
              >
                {/* Bilgi şeridi + kapat */}
                <View style={styles.previewBar}>
                  <View style={[styles.previewBadge, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                    <Text style={[Type.label, { color: T.textDim }]} numberOfLines={1}>👁️ Önizleme — profilini görenler bunu görür</Text>
                  </View>
                  <Pressable onPress={() => { tapH(); setPreviewOpen(false); }} hitSlop={10} style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                    <Text style={{ fontSize: 18, color: T.text }}>✕</Text>
                  </Pressable>
                </View>

                {/* Public kart: avatar + ad (+ yaş) */}
                <Animated.View entering={FadeIn.duration(300)} style={[styles.previewCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
                  <View style={styles.previewHeader}>
                    <StoryAvatar uri={resolveAvatar(photoUri, user?.name, gender)} name={user?.name ?? "✦"} size={104} hasStory={stories.length > 0} />
                    <Text style={[Type.h1, { color: T.text, marginTop: Space.md, textAlign: "center" }]}>
                      {user?.name ?? "Sen"}{previewAge != null ? `, ${previewAge}` : ""}
                    </Text>
                  </View>

                  {/* Story şeridi — yalnızca story varsa */}
                  {stories.length > 0 && (
                    <View style={{ marginTop: Space.lg }}>
                      <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>Story'ler</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.md, paddingVertical: 2 }}>
                        {stories.map((s) => (
                          <View key={s.ts} style={styles.previewStoryItem}>
                            <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storyRing}>
                              <Image source={{ uri: s.uri }} style={[styles.storyThumb, { borderColor: T.bg }]} contentFit="cover" transition={200} />
                            </LinearGradient>
                            {s.caption ? (
                              <Text style={[Type.micro, { color: T.textDim, maxWidth: 64, textAlign: "center" }]} numberOfLines={1}>{s.caption}</Text>
                            ) : null}
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Hakkımda (bio) — public */}
                  {dprof.about.trim() ? (
                    <View style={{ marginTop: Space.lg }}>
                      <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>Hakkımda</Text>
                      <Text style={[Type.body, { color: T.text }]}>{dprof.about.trim()}</Text>
                    </View>
                  ) : null}

                  {/* İlgi alanları — public */}
                  {interests.length > 0 && (
                    <View style={{ marginTop: Space.lg }}>
                      <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>İlgi alanları</Text>
                      <View style={styles.previewChips}>
                        {interests.map((i) => (
                          <View key={i} style={[styles.previewChip, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                            <Text style={[Type.label, { color: T.textDim }]}>{i}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Herkese açık sosyal hesaplar (pub=true) */}
                  <View style={{ marginTop: Space.lg }}>
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>Sosyal hesaplar</Text>
                    {publicSocials.length > 0 ? (
                      publicSocials.map((s) => (
                        <View key={s.key} style={[styles.previewSocialRow, { borderColor: T.hairline }]}>
                          <Text style={{ fontSize: 18 }}>{s.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[Type.title, { color: T.text }]}>{s.label}</Text>
                            <Text style={[Type.label, { color: T.textFaint }]} numberOfLines={1}>{social[s.key].handle.trim()}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={[Type.label, { color: T.textFaint }]}>Herkese açık hesap yok</Text>
                    )}
                  </View>
                </Animated.View>
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* Profil fotoğrafı kırpma ekranı (kare) */}
      <ImageEditor uri={cropUri} aspect={1} outWidth={512} title="Profil fotoğrafı" onDone={saveAvatar} onCancel={() => setCropUri(null)} />

      {/* Toast bildirimi */}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.toast, toastStyle, { backgroundColor: T.bgElevated, borderColor: T.hairline, bottom: insets.bottom + 96 }]}>
          <Text style={[Type.label, { color: T.text, textAlign: "center" }]}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Space.md },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  header: { alignItems: "center", marginBottom: Space.xl },
  avatarWrap: { alignItems: "center", justifyContent: "center" },
  avatar: { width: 86, height: 86, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  avatarMark: { fontSize: 34, color: "#fff", fontWeight: "800" },
  avatarEdit: { position: "absolute", right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  storyItem: { alignItems: "center", gap: 6, width: 72 },
  storyAdd: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 3 },
  storyRing: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", padding: 2 },
  storyThumb: { width: "100%", height: "100%", borderRadius: 30, borderWidth: 2 },
  // Aynı etkinlikte birden çok resim → segment sayısı rozeti (ring'in sağ-üstü).
  storyCount: { position: "absolute", top: 0, right: 4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  storyCountTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: Space.md, marginBottom: Space.xl },
  statCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Space.lg,
    paddingHorizontal: Space.sm,
    minHeight: 104,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  statValue: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.4 },
  emptyCard: { alignItems: "center", gap: 8, paddingVertical: Space.xl, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  saveBtn: { alignItems: "center", justifyContent: "center", paddingVertical: 15 },
  adminRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adminIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  googleBtn: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: Radius.pill, backgroundColor: "#fff", ...glow("#fff", 18, 0.18) },
  googleG: { fontSize: 17, fontWeight: "800", color: "#4285F4" },
  adminCard: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Space.lg, marginBottom: Space.xl },
  // Sayaç listesi alt-sayfası (modal)
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "82%", paddingHorizontal: 16, paddingTop: 10,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14, opacity: 0.6 },
  // Konum kartı
  locCard: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Space.md },
  locRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  locVal: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  locBtn: { paddingVertical: 14, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  citySearch: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: Radius.md, paddingHorizontal: Space.md, paddingVertical: 10, marginBottom: Space.sm },
  optRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  // Sosyal hesap satırı
  socialHead: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  socialToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  socialRow: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, marginBottom: Space.md, paddingHorizontal: Space.md, paddingTop: Space.sm },
  socialTop: { flexDirection: "row", alignItems: "center", gap: Space.sm, paddingVertical: Space.sm },
  socialInput: { flex: 1, paddingVertical: 4 },
  socialBottom: { flexDirection: "row", alignItems: "center", gap: Space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: Space.sm },
  // Story başlığı düzenleme modalı
  editBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  editCard: { width: "100%", maxWidth: 420, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Space.lg },
  editInput: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: Radius.md, paddingHorizontal: Space.md, paddingVertical: 12, marginBottom: Space.lg },
  editActions: { flexDirection: "row", gap: Space.md, justifyContent: "flex-end" },
  toast: {
    position: "absolute", left: 40, right: 40, paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center",
    ...glow("#000", 16, 0.3),
  },
  // 👁️ Önizleme modalı
  previewRoot: { flex: 1 },
  previewBar: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginBottom: Space.lg },
  previewBadge: { flex: 1, paddingHorizontal: Space.md, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  previewCard: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Space.lg },
  previewHeader: { alignItems: "center" },
  previewStoryItem: { alignItems: "center", gap: 6, width: 72 },
  previewChips: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  previewChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  previewSocialRow: { flexDirection: "row", alignItems: "center", gap: Space.md, paddingVertical: Space.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
