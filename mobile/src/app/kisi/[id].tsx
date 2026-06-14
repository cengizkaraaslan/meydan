import React from "react";
import { Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { getPerson, type Person } from "@/lib/people";
import { resolveAvatar } from "@/lib/avatar";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useCanSeeAges } from "@/lib/dprofile";
import { tapH, impactH } from "@/lib/haptics";
import { fetchFollowing, followUser, unfollowUser, followIdForPerson, fetchStoriesFor, fetchUserStats, fetchProfileById, type MobileStoryView, type UserStats, type PublicProfile } from "@/lib/social";
import { getOrCreateDeviceId } from "@/lib/device";
import { personStats as getPersonStats } from "@/lib/personStats";
import { EventStoryViewer, type StoryGroup } from "@/components/EventStoryViewer";

const { height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.58);

/** Kişi id'sinden deterministik (her açılışta aynı) istatistik sayıları üret. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function personStats(id: string): { storyCount: number; eventCount: number } {
  const h = hashStr(id);
  return {
    storyCount: h % 13, // 0-12
    eventCount: (h >>> 8) % 41, // 0-40
  };
}

/** YYYY-MM-DD doğum tarihinden yaş (geçersizse 0). */
function ageFromBirth(b?: string | null): number {
  if (!b) return 0;
  const d = new Date(b);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a > 0 && a < 120 ? a : 0;
}

export default function PersonScreen() {
  const { id, name: paramName, avatar: paramAvatar } = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const canSeeAges = useCanSeeAges();
  // Mock listede yoksa (gerçek Meydan kullanıcısı) gönderiden gelen ad/avatarla minimal
  // bir profil üret — "kişi bulunamadı" yerine isim+avatarla açılsın.
  const mockPerson = getPerson(String(id));
  const isReal = !mockPerson;
  // Gerçek kullanıcı: GERÇEK profil + istatistikleri sunucudan çek (mock değil).
  const [realProfile, setRealProfile] = React.useState<PublicProfile | null>(null);
  const [realStats, setRealStats] = React.useState<UserStats | null>(null);
  React.useEffect(() => {
    if (!isReal) return;
    let alive = true;
    fetchProfileById(String(id)).then((p) => { if (alive) setRealProfile(p); }).catch(() => {});
    fetchUserStats(String(id)).then((s) => { if (alive) setRealStats(s); }).catch(() => {});
    return () => { alive = false; };
  }, [id, isReal]);

  const person: Person | undefined = React.useMemo(() => {
    if (mockPerson) return mockPerson;
    if (!realProfile && !paramName && !paramAvatar) return undefined;
    const gender: "male" | "female" = realProfile?.gender === "female" ? "female" : "male";
    const name = (realProfile?.name || paramName || "Meydanlı").trim();
    return {
      id: String(id),
      name,
      age: ageFromBirth(realProfile?.birthDate),
      city: realProfile?.city || "",
      distanceKm: 0,
      online: false,
      avatar: resolveAvatar(realProfile?.avatar || paramAvatar || null, name, gender),
      bio: realProfile?.bio || "",
      interests: (realProfile?.interests || "").split(",").map((s) => s.trim()).filter(Boolean),
      gender,
    };
  }, [id, mockPerson, realProfile, paramName, paramAvatar]);

  // Üst sayaç (story/etkinlik): gerçek kullanıcıda GERÇEK; mock kişide deterministik.
  const stats = React.useMemo(
    () => (isReal && realStats ? { storyCount: realStats.stories, eventCount: realStats.attended } : personStats(String(id))),
    [id, isReal, realStats],
  );
  const followId = React.useMemo(() => followIdForPerson(String(id)), [id]);
  // Kendi profilim mi? (kendimi takip edemem). Takip kimliği = cihaz id'si.
  const [myId, setMyId] = React.useState("");
  React.useEffect(() => { getOrCreateDeviceId().then(setMyId).catch(() => {}); }, []);
  const isSelf = !!myId && (followId === myId || String(id) === myId);

  const [isFollowing, setIsFollowing] = React.useState(false);
  const [statsOpen, setStatsOpen] = React.useState(false);

  // Bu kişinin story'leri (başkasının gözünden görüntüleme).
  const [personStories, setPersonStories] = React.useState<MobileStoryView[]>([]);
  const [storyOpen, setStoryOpen] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    // followId: mock kişide u1→fake_u1, gerçek kullanıcıda deviceId (story sahibi id'si).
    fetchStoriesFor([followId]).then((s) => { if (alive) setPersonStories(s); }).catch(() => {});
    return () => { alive = false; };
  }, [followId]);
  const storyGroup = React.useMemo<StoryGroup>(
    () => ({
      id: String(id),
      name: person?.name ?? "",
      avatar: person?.avatar ?? "",
      segments: personStories.map((s) => ({
        id: s.id,
        uri: s.imageUrl,
        caption: s.caption ?? undefined,
        eventTitle: s.eventTitle ?? undefined,
      })),
    }),
    [id, person?.name, person?.avatar, personStories],
  );

  const detailedStats = React.useMemo(
    () =>
      isReal && realStats
        ? { attended: realStats.attended, reactions: realStats.reactions, comments: realStats.comments }
        : getPersonStats(String(id)),
    [id, isReal, realStats],
  );

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const following = await fetchFollowing();
      if (alive) setIsFollowing(following.includes(followId));
    })();
    return () => {
      alive = false;
    };
  }, [followId]);

  const toggleFollow = React.useCallback(() => {
    impactH();
    const next = !isFollowing;
    setIsFollowing(next); // iyimser: UI ANINDA değişir, butonu bekletme
    // Sunucu çağrısı ARKA PLANDA (fire-and-forget) → buton hiç disable olmaz, anlık his.
    void (async () => {
      try {
        if (next) await followUser(followId, person?.name);
        else await unfollowUser(followId);
      } catch {
        // Yalnız kullanıcı o yönde bırakmışsa geri al (arada tekrar dokunduysa dokunma).
        setIsFollowing((cur) => (cur === next ? !next : cur));
      }
    })();
  }, [isFollowing, followId, person?.name]);

  if (!person) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Text style={[Type.h2, { color: T.text }]}>{t("person_not_found")}</Text>
        <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10}>
          <Text style={{ color: T.primary, marginTop: 8 }}>← {t("back")}</Text>
        </Pressable>
      </View>
    );
  }

  const isVeryClose = person.distanceKm < 2;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
      >
        {/* Hero görsel — fotoğrafa dokun: istatistik modalı */}
        <View style={{ height: HERO_H, width: "100%" }}>
          <Pressable
            onPress={() => { tapH(); setStatsOpen(true); }}
            style={StyleSheet.absoluteFill}
          >
            <Image
              source={{ uri: person.avatar }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
              recyclingKey={person.id}
            />
          </Pressable>
          {/* Alt karartma — metin okunaklı olsun + zemine erisin (görseli üstte fazla karartma) */}
          <LinearGradient
            colors={["transparent", "transparent", "rgba(8,7,13,0.3)", T.bg]}
            locations={[0, 0.5, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Geri butonu */}
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={12}
            style={[styles.back, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.45)", borderColor: T.hairline }]}
          >
            <Text style={{ color: "#fff", fontSize: 20 }}>←</Text>
          </Pressable>

          {/* Çevrimiçi rozeti */}
          {person.online && (
            <Animated.View
              entering={FadeIn.duration(450)}
              style={[styles.onlineBadge, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.45)", borderColor: T.success }]}
            >
              <View style={[styles.dot, { backgroundColor: T.success }]} />
              <Text style={[Type.micro, { color: T.success }]}>{t("online").toUpperCase()}</Text>
            </Animated.View>
          )}

          {/* İsim bloğu — görselin altına biner */}
          <Animated.View entering={FadeInDown.delay(80).duration(480)} style={styles.nameBlock}>
            <Text style={[Type.hero, { color: T.text }]}>
              {canSeeAges && person.age ? `${person.name}, ${person.age}` : person.name}
            </Text>
            {person.distanceKm > 0 ? (
              <Text style={[Type.body, { color: isVeryClose ? T.success : T.textDim, marginTop: 4, fontWeight: "700" }]}>
                {isVeryClose
                  ? `📍 ${person.distanceKm} km · ${t("person_nearby")}`
                  : `📍 ${person.distanceKm} km ${t("away")}`}
              </Text>
            ) : null}
            {/* Sayaçlar — story varsa "📸 N story" tıklanabilir (story'leri izle) */}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 }}>
              {personStories.length > 0 ? (
                <Pressable onPress={() => { tapH(); setStoryOpen(true); }} hitSlop={6}>
                  <Text style={[Type.body, { color: T.primary, fontWeight: "800" }]}>📸 {personStories.length} story ▸</Text>
                </Pressable>
              ) : (
                <Text style={[Type.body, { color: T.textDim, fontWeight: "600" }]}>📸 0 story</Text>
              )}
              <Text style={[Type.body, { color: T.textDim, fontWeight: "600" }]}>· 🎟️ {stats.eventCount} etkinlik</Text>
            </View>
          </Animated.View>
        </View>

        {/* İçerik */}
        <View style={{ paddingHorizontal: 16, gap: 14, marginTop: 6 }}>
          {/* Katıldığı etkinliklerin hareketleri — rakamsal (görünür) */}
          <Animated.View entering={FadeInDown.delay(120).duration(460)} style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.h1, { color: T.cyan }]}>{detailedStats.attended}</Text>
              <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>🎉 Etkinlik</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.h1, { color: T.pink }]}>{detailedStats.reactions}</Text>
              <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>❤️ Tepki</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.h1, { color: T.gold }]}>{detailedStats.comments}</Text>
              <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>💬 Yorum</Text>
            </View>
          </Animated.View>

          {/* Hakkında */}
          <Animated.View entering={FadeInDown.delay(160).duration(460)}>
            <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: 8, letterSpacing: 0.6 }]}>
                {t("person_about").toUpperCase()}
              </Text>
              <Text style={[Type.body, { color: person.bio ? T.text : T.textFaint, lineHeight: 21 }]}>{person.bio || "Bu kullanıcı henüz bir bilgi paylaşmadı."}</Text>
              {/* TikTok hesabı (mock) */}
              {person.tiktok ? (
                <Pressable
                  onPress={() => { tapH(); Linking.openURL(`https://www.tiktok.com/${person.tiktok}`); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}
                  hitSlop={6}
                >
                  <Text style={{ fontSize: 15 }}>🎵</Text>
                  <Text style={[Type.body, { color: T.primary, fontWeight: "700" }]}>TikTok {person.tiktok}</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>

          {/* İlgi alanları */}
          <Animated.View entering={FadeInDown.delay(230).duration(460)}>
            <View style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: 10, letterSpacing: 0.6 }]}>
                {t("person_interests").toUpperCase()}
              </Text>
              <View style={styles.chips}>
                {person.interests.map((i) => (
                  <View
                    key={i}
                    style={[styles.chip, { borderColor: T.primary, backgroundColor: "rgba(168,85,247,0.14)" }]}
                  >
                    <Text style={[Type.label, { color: T.primary }]}>{i}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Takip et / Takip ediliyor — kendi profilimde GÖSTERME (kendimi takip edemem). */}
          {!isSelf ? (
          <Animated.View entering={FadeInDown.delay(285).duration(460)} style={{ marginTop: 8 }}>
            <Pressable
              onPress={toggleFollow}
              style={{ borderRadius: Radius.pill, overflow: "hidden" }}
            >
              {isFollowing ? (
                <View
                  style={[
                    styles.followBtn,
                    { backgroundColor: T.surface, borderColor: T.hairline, borderWidth: StyleSheet.hairlineWidth * 2 },
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>✓</Text>
                  <Text style={[Type.title, { color: T.text, fontSize: 16 }]}>Takip ediliyor</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={T.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.followBtn, glow(T.primary, 18, 0.45)]}
                >
                  <Text style={{ fontSize: 16 }}>＋</Text>
                  <Text style={[Type.title, { color: "#fff", fontSize: 16 }]}>Takip et</Text>
                </LinearGradient>
              )}
            </Pressable>
          </Animated.View>
          ) : null}

          {/* Mesaj Gönder */}
          <Animated.View entering={FadeInDown.delay(340).duration(460)}>
            <Pressable
              onPress={() => { impactH(); router.push({ pathname: "/sohbet/[id]", params: { id: person.id, name: person.name, avatar: person.avatar } }); }}
              style={{ borderRadius: Radius.pill, overflow: "hidden" }}
            >
              <LinearGradient
                colors={T.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.msgBtn, glow(T.primary, 22, 0.55)]}
              >
                <Text style={{ fontSize: 17 }}>💬</Text>
                <Text style={[Type.title, { color: "#fff", fontSize: 17 }]}>{t("person_message")}</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>

      {/* İstatistik modalı — fotoğrafa dokununca açılır */}
      <Modal visible={statsOpen} transparent animationType="fade" onRequestClose={() => setStatsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => { tapH(); setStatsOpen(false); }}>
          <Animated.View entering={FadeIn.duration(220)}>
            <Pressable
              onPress={() => {}}
              style={[styles.statsCard, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}
            >
              <Text style={[Type.label, { color: T.textFaint, letterSpacing: 0.6, marginBottom: 2 }]}>
                {person.name.toUpperCase()}
              </Text>
              <Text style={[Type.h2, { color: T.text, marginBottom: 16 }]}>İstatistikler</Text>

              <View style={styles.statsRow}>
                <View style={[styles.statBox, { borderColor: T.hairline }]}>
                  <Text style={styles.statEmoji}>🎉</Text>
                  <Text style={[Type.hero, { color: T.cyan }]}>{detailedStats.attended}</Text>
                  <Text style={[Type.label, { color: T.textDim }]}>Etkinlik</Text>
                </View>
                <View style={[styles.statBox, { borderColor: T.hairline }]}>
                  <Text style={styles.statEmoji}>❤️</Text>
                  <Text style={[Type.hero, { color: T.pink }]}>{detailedStats.reactions}</Text>
                  <Text style={[Type.label, { color: T.textDim }]}>Tepki</Text>
                </View>
                <View style={[styles.statBox, { borderColor: T.hairline }]}>
                  <Text style={styles.statEmoji}>💬</Text>
                  <Text style={[Type.hero, { color: T.gold }]}>{detailedStats.comments}</Text>
                  <Text style={[Type.label, { color: T.textDim }]}>Yorum</Text>
                </View>
              </View>

              <Pressable
                onPress={() => { tapH(); setStatsOpen(false); }}
                style={[styles.closeBtn, { borderColor: T.hairline }]}
              >
                <Text style={[Type.title, { color: T.text, fontSize: 15 }]}>Kapat</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Bu kişinin story'lerini başkasının gözünden izle */}
      {storyOpen ? (
        <EventStoryViewer groups={[storyGroup]} onClose={() => setStoryOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: "absolute",
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  onlineBadge: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nameBlock: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Space.lg,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 16,
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  statsCard: {
    width: "100%",
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 16,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  statEmoji: { fontSize: 22, marginBottom: 2 },
  closeBtn: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
