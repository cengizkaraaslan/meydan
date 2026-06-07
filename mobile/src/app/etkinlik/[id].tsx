import React, { useEffect, useState } from "react";
import { Alert, Dimensions, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { catMeta } from "@/lib/categories";
import { fmtLong, fmtPrice } from "@/lib/format";
import { API_BASE, fetchEventById, imageFor, type ApiEvent } from "@/lib/api";
import { getDeviceId } from "@/lib/profileSync";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { setAttending } from "@/lib/attending";
import { addStory } from "@/lib/stories";
import { Badge, GradientButton, Loader, Pill } from "@/ui/atoms";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { PEOPLE, type Person } from "@/lib/people";
import { StoryAvatar } from "@/components/StoryAvatar";
import { showAuthPrompt } from "@/lib/authPrompt";
import { tapH, impactH, successH } from "@/lib/haptics";
import { getEventWeather, type DayWeather } from "@/lib/weather";

const { width, height: SCREEN_H } = Dimensions.get("window");

interface Comment {
  id: string;
  name: string;
  text: string;
  ts: number;
  by?: string; // yükleyen kullanıcı id'si (düzenle/sil yetkisi); eski yorumlarda yok
  editedTs?: number; // düzenlendiyse zaman damgası
}

// Yorum düzenleme penceresi: 2 dakika.
const EDIT_WINDOW_MS = 2 * 60 * 1000;

/** Etkinliğe eklenen fotoğraf. `by` = yükleyen kullanıcı id'si (sahiplik/silme için). */
interface Photo {
  uri: string;
  by: string;
  ts: number;
}

type Rsvp = "going" | "maybe" | "interested";

interface Story {
  uri: string;
  caption: string;
  eventSlug: string;
  ts: number;
}

export default function EventDetail() {
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const insets = useSafeAreaInsets();
  const { ids } = useFavorites();
  const { t: T } = useTheme();
  const { t } = useT();
  const { user, guest } = useAuth();
  const [event, setEvent] = useState<ApiEvent | null>(null);
  const [loading, setLoading] = useState(true);

  // #14 — katılım / yorum / fotoğraf durumu
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  // Oturum açan kullanıcının sahiplik kimliği (foto/yorum düzenle-sil yetkisi).
  const ownerId = user?.id ?? user?.email?.toLowerCase() ?? "";
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [imgFailed, setImgFailed] = useState(false);

  // #18 — hava durumu
  const [weather, setWeather] = useState<DayWeather | null>(null);

  // story paylaşma akışı
  const [storyUri, setStoryUri] = useState<string | null>(null);
  const [storyCaption, setStoryCaption] = useState("");

  // katılacaklar listesi modal'ı
  const [listOpen, setListOpen] = useState(false);
  // story halkası olan kişiye dokununca story izleyici (yoksa profil açılır)
  const [viewStory, setViewStory] = useState<Person | null>(null);
  // avatara dokun/basılı tut → fotoğrafı büyütme modal'ı (uri)
  const [photoView, setPhotoView] = useState<string | null>(null);

  const eid = String(id);
  const rsvpKey = `meydanfest:rsvp:${eid}`;
  const commentsKey = `meydanfest:comments:${eid}`;
  const photosKey = `meydanfest:photos:${eid}`;

  useEffect(() => {
    // Önce parametreyle gelen etkinlik verisini kullan (anında, "bulunamadı" sorununu çözer).
    if (data) {
      try {
        setEvent(JSON.parse(data) as ApiEvent);
        setLoading(false);
        return;
      } catch {
        /* parse başarısızsa fetch'e düş */
      }
    }
    fetchEventById(eid).then((e) => {
      setEvent(e);
      setLoading(false);
    });
  }, [eid, data]);

  // #18 — event yüklenince hava durumunu çek (varsa kart göster)
  useEffect(() => {
    if (!event) return;
    let alive = true;
    getEventWeather(event.city, event.starts_at).then((w) => {
      if (alive) setWeather(w);
    });
    return () => { alive = false; };
  }, [event?.city, event?.starts_at]);

  // sakli durumu yükle
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // eski "going" anahtarıyla uyumluluk: varsa rsvp'ye taşı
        const legacyGoingKey = `meydanfest:going:${eid}`;
        const [r, legacy, c, p] = await Promise.all([
          AsyncStorage.getItem(rsvpKey),
          AsyncStorage.getItem(legacyGoingKey),
          AsyncStorage.getItem(commentsKey),
          AsyncStorage.getItem(photosKey),
        ]);
        if (!alive) return;
        if (r === "going" || r === "maybe" || r === "interested") {
          setRsvp(r);
        } else if (legacy === "1") {
          setRsvp("going");
          AsyncStorage.setItem(rsvpKey, "going");
        }
        if (c) setComments(JSON.parse(c));
        if (p) {
          // Eski format string[] idi; { uri, by, ts } objesine taşı (by="" = sahibi bilinmeyen eski foto).
          const arr = JSON.parse(p) as unknown[];
          const migrated: Photo[] = arr.map((x) =>
            typeof x === "string" ? { uri: x, by: "", ts: 0 } : (x as Photo),
          );
          setPhotos(migrated);
        }
      } catch {
        /* yok say */
      }
    })();
    return () => { alive = false; };
  }, [eid, rsvpKey, commentsKey, photosKey]);

  const chooseRsvp = (choice: Rsvp) => {
    // Oturum açmayan katılım (katılacağım/belki/ilgileniyorum) yapamaz → giriş modalı.
    if (!user) {
      showAuthPrompt(t("login_required"));
      return;
    }
    impactH();
    const next = rsvp === choice ? null : choice;
    setRsvp(next);
    if (next) AsyncStorage.setItem(rsvpKey, next);
    else AsyncStorage.removeItem(rsvpKey);
    // Profil "Katılacağım / Katıldığım" listeleri için tam etkinlik objesini sakla.
    if (event) setAttending(event, next);
    // best-effort API (join sinyali)
    if (event) {
      (async () => {
        try {
          const deviceId = await getDeviceId();
          await fetch(`${API_BASE}/api/v1/event-social`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
            body: JSON.stringify({ action: "join", deviceId, eventSlug: event.slug }),
          });
        } catch {
          /* yok say */
        }
      })();
    }
  };

  const persistComments = (next: Comment[]) => {
    setComments(next);
    AsyncStorage.setItem(commentsKey, JSON.stringify(next));
  };

  const canEditComment = (cm: Comment) =>
    !!user && cm.by === ownerId && Date.now() - cm.ts < EDIT_WINDOW_MS;
  const canDeleteComment = (cm: Comment) =>
    !!user && (isAdmin(user) || cm.by === ownerId);

  const startEditComment = (cm: Comment) => {
    tapH();
    setEditingId(cm.id);
    setEditDraft(cm.text);
  };
  const saveEditComment = () => {
    const text = editDraft.trim();
    if (!editingId || !text) { setEditingId(null); setEditDraft(""); return; }
    persistComments(comments.map((c) => (c.id === editingId ? { ...c, text, editedTs: Date.now() } : c)));
    setEditingId(null);
    setEditDraft("");
    successH();
  };
  const deleteComment = (cm: Comment) => {
    if (!canDeleteComment(cm)) return;
    tapH();
    Alert.alert(t("delete_comment_q"), undefined, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => { persistComments(comments.filter((c) => c.id !== cm.id)); successH(); } },
    ]);
  };

  const sendComment = () => {
    // Oturum açmayan yorum yazamaz → giriş modalı.
    if (!user) { showAuthPrompt(t("login_required")); return; }
    const text = draft.trim();
    if (!text) return;
    tapH();
    const c: Comment = {
      id: `c${Date.now()}`,
      name: user.name,
      text,
      ts: Date.now(),
      by: ownerId,
    };
    setComments((prev) => {
      const next = [...prev, c];
      AsyncStorage.setItem(commentsKey, JSON.stringify(next));
      return next;
    });
    setDraft("");
  };

  const addPhoto = async () => {
    // Oturum açmayan foto paylaşamaz → giriş modalı.
    if (!user) {
      showAuthPrompt(t("lock_photo_title"));
      return;
    }
    impactH();
    // İzin iste (olustur ekranıyla aynı akış) — yoksa seçici sessizce kapanıyordu (= "buton çalışmıyor").
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    const photo: Photo = { uri: res.assets[0].uri, by: ownerId, ts: Date.now() };
    setPhotos((prev) => {
      const next = [...prev, photo];
      AsyncStorage.setItem(photosKey, JSON.stringify(next));
      return next;
    });
    successH();
  };

  // Foto silinebilir mi? Sahibi (kendi yüklediği), admin ya da sahibi bilinmeyen eski foto (cihaza ait).
  const canDeletePhoto = (p: Photo) => !!user && (isAdmin(user) || !p.by || p.by === ownerId);

  const deletePhoto = (index: number) => {
    const p = photos[index];
    if (!p || !canDeletePhoto(p)) return;
    tapH();
    Alert.alert(t("delete_photo_q"), undefined, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => {
          setPhotos((prev) => {
            const next = prev.filter((_, i) => i !== index);
            AsyncStorage.setItem(photosKey, JSON.stringify(next));
            return next;
          });
          successH();
        },
      },
    ]);
  };

  // story: foto seç → önizleme + caption ekranı aç
  const pickStory = async () => {
    // Oturum açmayan story yükleyemez → giriş modalı.
    if (!user) {
      showAuthPrompt(t("lock_story_title"));
      return;
    }
    impactH();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    setStoryUri(res.assets[0].uri);
    setStoryCaption("");
  };

  // story: paylaş → local liste + best-effort API
  const shareStory = async () => {
    if (!storyUri || !event) return;
    const story: Story = {
      uri: storyUri,
      caption: storyCaption.trim(),
      eventSlug: event.slug,
      ts: Date.now(),
    };
    await addStory(story);
    // best-effort API (varsa /api/stories; yoksa sadece local kalır)
    try {
      const deviceId = await getDeviceId();
      await fetch(`${API_BASE}/api/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
        body: JSON.stringify({ deviceId, eventSlug: event.slug, caption: story.caption }),
      });
    } catch {
      /* yok say */
    }
    successH();
    setStoryUri(null);
    setStoryCaption("");
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: T.bg }}><Loader /></View>;
  if (!event) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Text style={[Type.h2, { color: T.text }]}>{t("event_not_found")}</Text>
        <Pressable onPress={() => { tapH(); router.back(); }}><Text style={{ color: T.primary }}>← {t("back")}</Text></Pressable>
      </View>
    );
  }

  const c = catMeta(event.category);
  const fav = ids.has(event.id);
  // kırık görsel → kategori fallback (kategori emojili düz blok). imgFailed true ise emoji bloğu göster.
  const heroUri = imageFor(event);
  // katılacaklar — "katılacağım" diyen kullanıcı listenin BAŞINDA görünür (yerel).
  // NOT: gerçek çapraz-cihaz katılımcılar (android↔web) Postgres + eventAttendance ile
  // gelecek; şimdilik kendi RSVP'n anında görünür.
  const meAttendee: Person | null =
    rsvp === "going" && user
      ? {
          id: "__me",
          name: user.name,
          age: 0,
          city: event.city,
          distanceKm: 0,
          online: true,
          avatar: user.photo || "https://i.pravatar.cc/600?img=12",
          bio: "",
          interests: [],
          gender: "male",
        }
      : null;
  const attendeeList = meAttendee ? [meAttendee, ...PEOPLE] : PEOPLE;
  const attendees = attendeeList.slice(0, 6);
  const extraAttendees = Math.max(0, attendeeList.length - attendees.length);

  const openTicket = () => {
    impactH();
    if (event.ticket_url) WebBrowser.openBrowserAsync(event.ticket_url);
  };
  const openMap = () => {
    tapH();
    const q = encodeURIComponent(`${event.venue} ${event.city}`.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };
  const share = () => {
    impactH();
    Share.share({ message: `${event.title} — ${fmtLong(event.starts_at)} · ${event.city}\n${event.ticket_url ?? ""}` });
  };
  // katılacaklar listesinden bir kişiye mesaj — sohbet için giriş zorunlu (uygulama kuralı)
  const messagePerson = (pid: string) => {
    impactH();
    setListOpen(false);
    if (!user) {
      showAuthPrompt(t("lock_chat_title"));
      return;
    }
    router.push(`/sohbet/${pid}`);
  };
  const openPerson = (pid: string) => {
    tapH();
    setListOpen(false);
    router.push(`/kisi/${pid}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Hero görsel */}
        <View style={{ height: width * 1.05 }}>
          {imgFailed ? (
            <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ fontSize: 90 }}>{c.emoji}</Text>
            </LinearGradient>
          ) : (
            <Image
              source={{ uri: heroUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={350}
              onError={() => setImgFailed(true)}
            />
          )}
          <LinearGradient colors={["rgba(8,7,13,0.5)", "transparent", "rgba(8,7,13,0.6)", T.bg]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
          {/* Üst bar */}
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            <Pressable onPress={() => { tapH(); router.back(); }} style={[styles.circleBtn, { borderColor: T.hairline }]}><Text style={styles.circleTxt}>←</Text></Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={share} style={[styles.circleBtn, { borderColor: T.hairline }]}><Text style={styles.circleTxt}>↗</Text></Pressable>
              <Pressable
                onPress={async () => {
                  // Oturum açmayan favori ekleyemez → giriş modalı.
                  if (!user) { showAuthPrompt(t("login_required_fav")); return; }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  await toggleFavorite(event);
                }}
                style={[styles.circleBtn, { borderColor: T.hairline }]}
              >
                <Text style={{ fontSize: 17 }}>{fav ? "❤️" : "🤍"}</Text>
              </Pressable>
            </View>
          </View>
          {/* Başlık bloğu */}
          <View style={styles.heroInfo}>
            <Badge text={c.label} color={c.gradient[0]} style={{ alignSelf: "flex-start", marginBottom: 10 }} />
            <Text style={[Type.hero, { color: "#fff" }]}>{event.title}</Text>
          </View>
        </View>

        {/* Bilgi kartları */}
        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 6 }}>
          <Animated.View entering={FadeInDown.duration(450)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <InfoRow T={T} icon="🗓️" label={t("date")} value={fmtLong(event.starts_at)} />
            <View style={[styles.sep, { backgroundColor: T.hairline }]} />
            <InfoRow T={T} icon="📍" label={t("venue")} value={event.venue || event.city || t("not_specified")} onPress={openMap} actionLabel={t("see_on_map")} />
            <View style={[styles.sep, { backgroundColor: T.hairline }]} />
            <InfoRow
              T={T}
              icon="🎟️"
              label={t("ticket")}
              value={fmtPrice(event)}
              valueColor={event.is_free ? T.success : T.gold}
              onPress={event.ticket_url ? openTicket : undefined}
              actionLabel={event.ticket_url ? (event.is_free ? t("go_detail") : t("buy_ticket")) : undefined}
            />
            {event.artist ? (<><View style={[styles.sep, { backgroundColor: T.hairline }]} /><InfoRow T={T} icon="🎤" label={t("artist")} value={event.artist} /></>) : null}
          </Animated.View>

          {event.description ? (
            <Animated.View entering={FadeInDown.duration(450).delay(60)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: 8 }]}>{t("description")}</Text>
              <Text style={[Type.body, { color: T.textDim, lineHeight: 22 }]}>{event.description}</Text>
            </Animated.View>
          ) : null}

          {/* #18 — Hava durumu (açıklamanın ALTINDA, yalnızca veri varsa) */}
          {weather ? (
            <Animated.View entering={FadeInDown.duration(450).delay(90)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Text style={{ fontSize: 48 }}>{weather.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[Type.label, { color: T.textFaint, marginBottom: 4 }]}>{t("weather")}</Text>
                  <Text style={[Type.h2, { color: T.text }]}>{weather.tempMax}° / {weather.tempMin}°</Text>
                  <Text style={[Type.body, { color: T.textDim, marginTop: 2 }]}>{weather.label}</Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {/* #14 — RSVP (katılım durumu) segment */}
          <Animated.View entering={FadeInDown.duration(450).delay(160)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>🙋 {t("join_event")}</Text>
            <View style={styles.rsvpRow}>
              <Pill label={t("rsvp_going")} active={rsvp === "going"} gradient={c.gradient} onPress={() => chooseRsvp("going")} />
              <Pill label={t("rsvp_maybe")} active={rsvp === "maybe"} gradient={c.gradient} onPress={() => chooseRsvp("maybe")} />
              <Pill label={t("rsvp_interested")} active={rsvp === "interested"} gradient={c.gradient} onPress={() => chooseRsvp("interested")} />
            </View>
          </Animated.View>

          {/* Story paylaş (#C web stories gibi) */}
          <Animated.View entering={FadeInDown.duration(450).delay(180)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            {storyUri ? (
              <View style={{ gap: 12 }}>
                <Image source={{ uri: storyUri }} style={styles.storyPreview} contentFit="cover" transition={200} />
                <TextInput
                  value={storyCaption}
                  onChangeText={setStoryCaption}
                  placeholder={t("write_comment")}
                  placeholderTextColor={T.textFaint}
                  style={[styles.input, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
                  returnKeyType="done"
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => { tapH(); setStoryUri(null); setStoryCaption(""); }}
                    style={[styles.addPhoto, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}
                  >
                    <Text style={[Type.label, { color: T.textDim }]}>{t("back")}</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <GradientButton label={t("send")} icon="✦" gradient={c.gradient} onPress={shareStory} />
                  </View>
                </View>
              </View>
            ) : (
              <GradientButton label={`📸 ${t("share_story")}`} gradient={c.gradient} onPress={pickStory} />
            )}
          </Animated.View>

          {/* #14 — Etkinliğe katılacaklar (dokun → liste + her satırda "Mesaj at") */}
          <Animated.View entering={FadeInDown.duration(450).delay(200)}>
            <Pressable
              onPress={() => { tapH(); setListOpen(true); }}
              style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={[Type.label, { color: T.textFaint }]}>👥 {t("attendees")}</Text>
                <Text style={[Type.label, { color: T.primary }]}>{attendeeList.length} →</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {attendees.map((p, i) => (
                  <Image
                    key={p.id}
                    source={{ uri: p.avatar }}
                    style={[styles.avatar, { borderColor: T.bg, marginLeft: i === 0 ? 0 : -12 }]}
                    contentFit="cover"
                    transition={200}
                  />
                ))}
                {extraAttendees > 0 ? (
                  <View style={[styles.avatar, styles.avatarMore, { marginLeft: -12, borderColor: T.bg, backgroundColor: T.surfaceStrong }]}>
                    <Text style={[Type.label, { color: T.textDim }]}>+{extraAttendees}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 13 }}>💬</Text>
                <Text style={[Type.label, { color: T.primary }]}>{t("message_attendee")} →</Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* #14 — Yorumlar */}
          <Animated.View entering={FadeInDown.duration(450).delay(240)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>{t("comments")}</Text>
            {comments.length === 0 ? (
              <Text style={[Type.body, { color: T.textFaint, marginBottom: 14 }]}>{t("no_comments")}</Text>
            ) : (
              <View style={{ gap: 10, marginBottom: 14 }}>
                {comments.map((cm) => {
                  const editing = editingId === cm.id;
                  const initial = (cm.name?.charAt(0) || "?").toUpperCase();
                  return (
                    <View key={cm.id} style={[styles.bubble, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cmAvatar}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{initial}</Text>
                        </LinearGradient>
                        <Text style={[Type.label, { color: T.text, flex: 1 }]} numberOfLines={1}>{cm.name}</Text>
                        {cm.editedTs ? <Text style={[Type.micro, { color: T.textFaint }]}>{t("edited")}</Text> : null}
                      </View>
                      {editing ? (
                        <View style={{ gap: 8 }}>
                          <TextInput
                            value={editDraft}
                            onChangeText={setEditDraft}
                            placeholderTextColor={T.textFaint}
                            multiline
                            style={[styles.input, { color: T.text, backgroundColor: T.bgElevated, borderColor: T.hairline, minHeight: 42, textAlignVertical: "top" }]}
                          />
                          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                            <Pill label={t("cancel")} onPress={() => { setEditingId(null); setEditDraft(""); }} />
                            <Pill label={t("save")} gradient={c.gradient} onPress={saveEditComment} />
                          </View>
                        </View>
                      ) : (
                        <Text style={[Type.body, { color: T.text, lineHeight: 20 }]}>{cm.text}</Text>
                      )}
                      {!editing && (canEditComment(cm) || canDeleteComment(cm)) ? (
                        <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                          {canEditComment(cm) ? (
                            <Pressable onPress={() => startEditComment(cm)} hitSlop={6}>
                              <Text style={[Type.micro, { color: T.primary }]}>✏️ {t("edit")}</Text>
                            </Pressable>
                          ) : null}
                          {canDeleteComment(cm) ? (
                            <Pressable onPress={() => deleteComment(cm)} hitSlop={6}>
                              <Text style={[Type.micro, { color: T.pink }]}>🗑️ {t("delete")}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t("write_comment")}
                placeholderTextColor={T.textFaint}
                style={[styles.input, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
                onSubmitEditing={sendComment}
                returnKeyType="send"
              />
              <Pressable
                onPress={sendComment}
                disabled={!draft.trim()}
                style={{ borderRadius: Radius.pill, overflow: "hidden", opacity: draft.trim() ? 1 : 0.5 }}
              >
                <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
                  <Text style={[Type.label, { color: "#fff" }]}>{t("send")}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>

          {/* #14 — Fotoğraf ekle */}
          <Animated.View entering={FadeInDown.duration(450).delay(280)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: photos.length ? 12 : 0 }}>
              <Text style={[Type.label, { color: T.textFaint }]}>📸</Text>
              <Pressable onPress={addPhoto} style={{ borderRadius: Radius.pill, overflow: "hidden" }}>
                <View style={[styles.addPhoto, { borderColor: T.hairline, backgroundColor: T.surfaceStrong }]}>
                  <Text style={[Type.label, { color: T.text }]}>+ {t("add_photo")}</Text>
                </View>
              </Pressable>
            </View>
            {photos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`}>
                    <Image source={{ uri: p.uri }} style={styles.photo} contentFit="cover" transition={200} />
                    {canDeletePhoto(p) ? (
                      <Pressable onPress={() => deletePhoto(i)} hitSlop={8} style={styles.photoDel}>
                        <Text style={{ fontSize: 13 }}>🗑️</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Animated.View>

          {guest ? <View style={{ height: 2 }} /> : null}
        </View>
      </ScrollView>

      {/* Katılacaklar listesi — bottom-sheet; her satırda "Mesaj at" */}
      <Modal visible={listOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setListOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: T.bgElevated, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: T.hairline }]} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={[Type.h2, { color: T.text }]}>👥 {t("attendees")} · {attendeeList.length}</Text>
            <Pressable onPress={() => { tapH(); setListOpen(false); }} hitSlop={10}>
              <Text style={{ color: T.textDim, fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.6 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
            {attendeeList.map((p) => {
              const isMe = p.id === "__me";
              return (
                <View key={p.id} style={[styles.attRow, { backgroundColor: T.surface, borderColor: isMe ? T.primary : T.hairline }]}>
                  {/* Avatar: dokun → story varsa story, yoksa fotoğrafı büyüt; basılı tut → fotoğrafı büyüt */}
                  <Pressable
                    onPress={() => {
                      tapH();
                      if (!isMe && p.hasStory) { setListOpen(false); setViewStory(p); }
                      else setPhotoView(p.avatar);
                    }}
                    onLongPress={() => { tapH(); setPhotoView(p.avatar); }}
                    delayLongPress={250}
                  >
                    <StoryAvatar uri={p.avatar} name={p.name} size={50} hasStory={p.hasStory} online={p.online} />
                  </Pressable>
                  {/* İsim/şehir: profili aç */}
                  <Pressable
                    onPress={() => { if (!isMe) openPerson(p.id); }}
                    style={{ flex: 1 }}
                  >
                    <Text style={[Type.title, { color: T.text }]} numberOfLines={1}>{isMe ? `${p.name} · ${t("you") }` : `${p.name}, ${p.age}`}</Text>
                    <Text style={[Type.label, { color: T.textFaint }]} numberOfLines={1}>{isMe ? `✓ ${t("rsvp_going")}` : `📍 ${p.city} · ${p.distanceKm} km`}</Text>
                  </Pressable>
                  {!isMe ? (
                    <Pressable onPress={() => messagePerson(p.id)} style={{ borderRadius: Radius.pill, overflow: "hidden" }}>
                      <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.attMsgBtn}>
                        <Text style={{ fontSize: 13 }}>💬</Text>
                        <Text style={[Type.label, { color: "#fff" }]}>{t("message_attendee")}</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Story izleyici — story halkası olan kişiye dokununca. Mock kişilerde gerçek
          story medyası yok → avatar tam ekran gösterilir; gerçek story'ler DB ile gelecek. */}
      <Modal visible={!!viewStory} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewStory(null)}>
        <Animated.View entering={FadeIn.duration(160)} style={styles.storyViewer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setViewStory(null)} />
          {viewStory ? (
            <>
              <View style={[styles.storyBarTop, { top: insets.top + 8 }]}>
                <View style={[styles.storyProgress, { backgroundColor: T.primary }]} />
              </View>
              <Image source={{ uri: viewStory.avatar }} style={styles.storyViewerImg} contentFit="cover" transition={200} />
              <Pressable
                onPress={() => { const id = viewStory.id; setViewStory(null); router.push(`/kisi/${id}`); }}
                style={[styles.storyViewerInfo, { top: insets.top + 22 }]}
                hitSlop={8}
              >
                <StoryAvatar uri={viewStory.avatar} name={viewStory.name} size={38} online={viewStory.online} />
                <Text style={[Type.title, { color: "#fff" }]}>{viewStory.name}</Text>
              </Pressable>
              <Pressable
                onPress={() => { const id = viewStory.id; setViewStory(null); router.push(`/kisi/${id}`); }}
                style={[styles.storyProfileBtn, { bottom: insets.bottom + 28 }]}
              >
                <Text style={[Type.title, { color: "#fff" }]}>👤 {viewStory.name} · {t("person_about")} →</Text>
              </Pressable>
            </>
          ) : null}
        </Animated.View>
      </Modal>

      {/* Avatar fotoğrafını büyütme modal'ı (dokun/basılı tut) */}
      <Modal visible={!!photoView} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPhotoView(null)}>
        <Pressable style={styles.photoModalBg} onPress={() => setPhotoView(null)}>
          {photoView ? <Image source={{ uri: photoView }} style={styles.photoModalImg} contentFit="contain" transition={150} /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function InfoRow({ T, icon, label, value, valueColor, onPress, actionLabel }: { T: Palette; icon: string; label: string; value: string; valueColor?: string; onPress?: () => void; actionLabel?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.infoRow}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[Type.label, { color: T.textFaint }]}>{label}</Text>
        <Text style={[Type.title, { color: valueColor ?? T.text }]}>{value}</Text>
        {onPress && actionLabel ? <Text style={[Type.label, { color: T.primary, marginTop: 2 }]}>{actionLabel}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  circleTxt: { color: "#fff", fontSize: 18, fontWeight: "700" },
  heroInfo: { position: "absolute", bottom: 16, left: 16, right: 16 },
  infoCard: { borderRadius: Radius.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth * 2, ...glow("#000", 10, 0.2) },
  infoRow: { flexDirection: "row", gap: 14, alignItems: "center", paddingVertical: 6 },
  sep: { height: StyleSheet.hairlineWidth * 2, marginVertical: 6 },
  rsvpRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  storyPreview: { width: "100%", height: 200, borderRadius: Radius.md },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarMore: { alignItems: "center", justifyContent: "center" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: 16, paddingTop: 10 },
  sheetHandle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 14 },
  attRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  attAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2 },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  attMsgBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9 },
  bubble: { borderRadius: Radius.md, padding: 12, borderWidth: StyleSheet.hairlineWidth * 2 },
  cmAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth * 2, fontSize: 14 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  addPhoto: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  photo: { width: 100, height: 100, borderRadius: Radius.md },
  storyViewer: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  storyViewerImg: { width: "100%", height: "100%" },
  storyBarTop: { position: "absolute", left: 12, right: 12, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  storyProgress: { position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", borderRadius: 2 },
  storyViewerInfo: { position: "absolute", left: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  storyProfileBtn: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.55)", borderWidth: StyleSheet.hairlineWidth * 2, borderColor: "rgba(255,255,255,0.3)", paddingHorizontal: 18, paddingVertical: 12, borderRadius: Radius.pill },
  photoModalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
  photoModalImg: { width: "94%", height: "78%", borderRadius: Radius.lg },
  photoDel: {
    position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },
});
