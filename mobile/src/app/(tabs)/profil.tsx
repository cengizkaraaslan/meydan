import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AuroraBackground } from "@/components/AuroraBackground";
import { GlassCard } from "@/components/GlassCard";
import { EventRow } from "@/components/EventCard";
import { ImageEditor } from "@/components/ImageEditor";
import { deleteLocalFile } from "@/lib/fileStore";
import { StoryAvatar } from "@/components/StoryAvatar";
import { Pill, SectionHeader } from "@/ui/atoms";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useFavorites } from "@/lib/favorites";
import { useAttending } from "@/lib/attending";
import { useStories, addStory, type Story } from "@/lib/stories";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { showAuthPrompt } from "@/lib/authPrompt";
import { syncProfile } from "@/lib/profileSync";
import { tapH, impactH, successH } from "@/lib/haptics";

function Stat({ value, label, color, T }: { value: string; label: string; color: string; T: Palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[Type.h1, { color }]}>{value}</Text>
      <Text style={[Type.label, { color: T.textFaint, marginTop: 6, textAlign: "center" }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

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
  const { list: favs } = useFavorites();
  const { upcoming, past } = useAttending();
  const { stories, remove, reload } = useStories();
  const [viewer, setViewer] = useState<Story | null>(null);

  // Profil fotoğrafı — kullanıcı kendi seçtiği görseli ayarlayabilir (yerelde + DB'ye senkron).
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null); // kırpma ekranına gidecek ham görsel
  useEffect(() => {
    AsyncStorage.getItem("meydanfest:avatar").then(setAvatarOverride);
  }, []);
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

  // Düzenleme onayı → kaydet (yerel + DB senkron) + ÖNCEKİ avatar dosyasını sil (şişmesin).
  const saveAvatar = (uri: string) => {
    const prev = avatarOverride;
    setCropUri(null);
    setAvatarOverride(uri);
    AsyncStorage.setItem("meydanfest:avatar", uri);
    syncProfile({ avatar: uri });
    if (prev && prev !== uri) deleteLocalFile(prev); // file:// değilse (Google foto) dokunmaz
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

  const deleteStory = (s: Story) => {
    remove(s.ts);
    setViewer(null);
    successH();
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 130, paddingHorizontal: 16 }}>
        {/* Üst bar — başlık + ayarlar */}
        <View style={styles.topBar}>
          <Text style={[Type.h2, { color: T.text }]}>{t("tab_profile")}</Text>
          <Pressable onPress={() => { tapH(); router.push("/ayarlar"); }} hitSlop={10} style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </Pressable>
        </View>

        {/* Profil başlığı */}
        <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
          <Pressable onPress={changePhoto} style={styles.avatarWrap}>
            {/* Story yüklediyse avatarda Instagram-tarzı halka (StoryAvatar) */}
            <StoryAvatar uri={photoUri} name={user?.name ?? "✦"} size={84} hasStory={stories.length > 0} />
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
            {/* Story'ler */}
            {stories.map((s) => (
              <Pressable key={s.ts} onPress={() => { tapH(); setViewer(s); }} style={styles.storyItem}>
                <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storyRing}>
                  <Image source={{ uri: s.uri }} style={[styles.storyThumb, { borderColor: T.bg }]} contentFit="cover" transition={200} />
                </LinearGradient>
                <Text style={[Type.micro, { color: T.textDim, maxWidth: 64, textAlign: "center" }]} numberOfLines={1}>{t("view_story")}</Text>
              </Pressable>
            ))}
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

        {/* İstatistik */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)}>
          <GlassCard glowColor={T.indigo} style={{ marginBottom: Space.xl }}>
            <View style={styles.statsRow}>
              <Stat T={T} value={String(upcoming.length)} label={t("my_upcoming")} color={T.cyan} />
              <View style={[styles.vline, { backgroundColor: T.hairline }]} />
              <Stat T={T} value={String(past.length)} label={t("my_past")} color={T.gold} />
              <View style={[styles.vline, { backgroundColor: T.hairline }]} />
              <Stat T={T} value={String(favs.length)} label={t("tab_favorites")} color={T.pink} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Yönetim — sadece admin */}
        {isAdmin(user) && (
          <Animated.View entering={FadeInDown.duration(450).delay(100)}>
            <Pressable onPress={() => { tapH(); router.push("/admin"); }} style={{ marginBottom: Space.xl }}>
              <GlassCard glowColor={T.gold} padded>
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
              </GlassCard>
            </Pressable>
          </Animated.View>
        )}

        {/* Katılacağım etkinlikler */}
        <Animated.View entering={FadeInDown.duration(450).delay(120)}>
          <SectionHeader title={t("my_upcoming")} accent={T.cyan} />
          <View style={{ gap: Space.sm, marginBottom: Space.xl }}>
            {upcoming.length ? (
              upcoming.map((it) => <EventRow key={it.event.id} event={it.event} />)
            ) : (
              <EmptyMini emoji="🗓️" text={t("no_events_yet")} T={T} />
            )}
          </View>
        </Animated.View>

        {/* Katıldığım etkinlikler */}
        <Animated.View entering={FadeInDown.duration(450).delay(160)}>
          <SectionHeader title={t("my_past")} accent={T.gold} />
          <View style={{ gap: Space.sm, marginBottom: Space.xl }}>
            {past.length ? (
              past.map((it) => <EventRow key={it.event.id} event={it.event} />)
            ) : (
              <EmptyMini emoji="🎟️" text={t("no_events_yet")} T={T} />
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Story izleyici */}
      <Modal visible={!!viewer} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        <Animated.View entering={FadeIn.duration(180)} style={styles.viewerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewer(null)} />
          {viewer ? (
            <View style={styles.viewerCard}>
              <Image source={{ uri: viewer.uri }} style={styles.viewerImg} contentFit="cover" transition={200} />
              {viewer.caption ? <Text style={[Type.title, { color: "#fff", marginTop: Space.md, textAlign: "center" }]}>{viewer.caption}</Text> : null}
              <View style={{ flexDirection: "row", gap: Space.md, marginTop: Space.lg }}>
                <Pill label={t("delete")} onPress={() => deleteStory(viewer)} />
                <Pill label={t("back")} gradient={T.primarySoft} onPress={() => setViewer(null)} />
              </View>
            </View>
          ) : null}
        </Animated.View>
      </Modal>

      {/* Profil fotoğrafı kırpma ekranı (kare) */}
      <ImageEditor uri={cropUri} aspect={1} outWidth={512} title="Profil fotoğrafı" onDone={saveAvatar} onCancel={() => setCropUri(null)} />
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
  statsRow: { flexDirection: "row", alignItems: "stretch", justifyContent: "space-around", paddingVertical: 2 },
  stat: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 4, minHeight: 62 },
  vline: { width: StyleSheet.hairlineWidth * 2, alignSelf: "stretch", marginVertical: 4 },
  emptyCard: { alignItems: "center", gap: 8, paddingVertical: Space.xl, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  adminRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adminIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  googleBtn: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: Radius.pill, backgroundColor: "#fff", ...glow("#fff", 18, 0.18) },
  googleG: { fontSize: 17, fontWeight: "800", color: "#4285F4" },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 20 },
  viewerCard: { alignItems: "center", width: "100%" },
  viewerImg: { width: "100%", height: 460, borderRadius: Radius.lg },
});
