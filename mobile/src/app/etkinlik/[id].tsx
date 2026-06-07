import React, { useEffect, useState } from "react";
import { Dimensions, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { catMeta } from "@/lib/categories";
import { fmtLong, fmtPrice } from "@/lib/format";
import { API_BASE, fetchEventById, imageFor, type ApiEvent } from "@/lib/api";
import { getDeviceId } from "@/lib/profileSync";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { Badge, GradientButton, Loader, Pill } from "@/ui/atoms";
import { GlassCard } from "@/components/GlassCard";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { PEOPLE } from "@/lib/people";
import { tapH, impactH, successH } from "@/lib/haptics";
import { getEventWeather, type DayWeather } from "@/lib/weather";

const { width } = Dimensions.get("window");

interface Comment {
  id: string;
  name: string;
  text: string;
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
  const [photos, setPhotos] = useState<string[]>([]);
  const [imgFailed, setImgFailed] = useState(false);

  // #18 — hava durumu
  const [weather, setWeather] = useState<DayWeather | null>(null);

  // story paylaşma akışı
  const [storyUri, setStoryUri] = useState<string | null>(null);
  const [storyCaption, setStoryCaption] = useState("");

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
        if (p) setPhotos(JSON.parse(p));
      } catch {
        /* yok say */
      }
    })();
    return () => { alive = false; };
  }, [eid, rsvpKey, commentsKey, photosKey]);

  const chooseRsvp = (choice: Rsvp) => {
    impactH();
    setRsvp((prev) => {
      const next = prev === choice ? null : choice;
      if (next) AsyncStorage.setItem(rsvpKey, next);
      else AsyncStorage.removeItem(rsvpKey);
      return next;
    });
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

  const sendComment = () => {
    const text = draft.trim();
    if (!text) return;
    tapH();
    const c: Comment = {
      id: `c${Date.now()}`,
      name: user?.name ?? "Misafir",
      text,
      ts: Date.now(),
    };
    setComments((prev) => {
      const next = [...prev, c];
      AsyncStorage.setItem(commentsKey, JSON.stringify(next));
      return next;
    });
    setDraft("");
  };

  const addPhoto = async () => {
    impactH();
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    const uri = res.assets[0].uri;
    setPhotos((prev) => {
      const next = [...prev, uri];
      AsyncStorage.setItem(photosKey, JSON.stringify(next));
      return next;
    });
    successH();
  };

  // story: foto seç → önizleme + caption ekranı aç
  const pickStory = async () => {
    impactH();
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
    try {
      const raw = await AsyncStorage.getItem("meydanfest:stories");
      const list: Story[] = raw ? JSON.parse(raw) : [];
      list.unshift(story);
      await AsyncStorage.setItem("meydanfest:stories", JSON.stringify(list));
    } catch {
      /* yok say */
    }
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
  // katılacaklar — mock, ilk 6 + kalan rozeti
  const attendees = PEOPLE.slice(0, 6);
  const extraAttendees = Math.max(0, 18 - attendees.length);

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
                onPress={async () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await toggleFavorite(event); }}
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
            <InfoRow T={T} icon="🎟️" label={t("ticket")} value={fmtPrice(event)} valueColor={event.is_free ? T.success : T.gold} />
            {event.artist ? (<><View style={[styles.sep, { backgroundColor: T.hairline }]} /><InfoRow T={T} icon="🎤" label={t("artist")} value={event.artist} /></>) : null}
          </Animated.View>

          {/* #18 — Hava durumu (yalnızca veri varsa) */}
          {weather ? (
            <Animated.View entering={FadeInDown.duration(450).delay(90)}>
              <GlassCard glowColor={c.gradient[0]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Text style={{ fontSize: 48 }}>{weather.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: 4 }]}>{t("weather")}</Text>
                    <Text style={[Type.h2, { color: T.text }]}>{weather.tempMax}° / {weather.tempMin}°</Text>
                    <Text style={[Type.body, { color: T.textDim, marginTop: 2 }]}>{weather.label}</Text>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>
          ) : null}

          {event.description ? (
            <Animated.View entering={FadeInDown.duration(450).delay(60)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: 8 }]}>{t("description")}</Text>
              <Text style={[Type.body, { color: T.textDim, lineHeight: 22 }]}>{event.description}</Text>
            </Animated.View>
          ) : null}

          <View style={{ height: 4 }} />
          {event.ticket_url ? (
            <Animated.View entering={FadeInDown.duration(450).delay(120)}>
              <GradientButton label={event.is_free ? t("go_detail") : t("buy_ticket")} icon="✦" gradient={c.gradient} onPress={openTicket} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(450).delay(120)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline, alignItems: "center" }]}>
              <Text style={[Type.body, { color: T.textFaint }]}>{t("no_ticket")}</Text>
            </Animated.View>
          )}

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

          {/* #14 — Katılacaklar */}
          <Animated.View entering={FadeInDown.duration(450).delay(200)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>{t("attendees")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {attendees.map((p, i) => (
                /* #19b — avatara dokun → /kisi/[id] (profil + Mesaj at) */
                <Pressable
                  key={p.id}
                  onPress={() => { tapH(); router.push(`/kisi/${p.id}`); }}
                  style={{ marginLeft: i === 0 ? 0 : -12 }}
                >
                  <Image
                    source={{ uri: p.avatar }}
                    style={[styles.avatar, { borderColor: T.bg }]}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
              ))}
              {extraAttendees > 0 ? (
                <View style={[styles.avatar, styles.avatarMore, { marginLeft: -12, borderColor: T.bg, backgroundColor: T.surfaceStrong }]}>
                  <Text style={[Type.label, { color: T.textDim }]}>+{extraAttendees}</Text>
                </View>
              ) : null}
            </View>
            {/* #19b — görünür ipucu: avatara dokun → profil + mesaj at */}
            <Pressable
              onPress={() => { tapH(); if (attendees[0]) router.push(`/kisi/${attendees[0].id}`); }}
              style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={{ fontSize: 13 }}>💬</Text>
              <Text style={[Type.label, { color: T.primary }]}>{t("message_attendee")} →</Text>
            </Pressable>
          </Animated.View>

          {/* #14 — Yorumlar */}
          <Animated.View entering={FadeInDown.duration(450).delay(240)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>{t("comments")}</Text>
            {comments.length === 0 ? (
              <Text style={[Type.body, { color: T.textFaint, marginBottom: 14 }]}>{t("no_comments")}</Text>
            ) : (
              <View style={{ gap: 10, marginBottom: 14 }}>
                {comments.map((cm) => (
                  <View key={cm.id} style={[styles.bubble, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                    <Text style={[Type.label, { color: T.primary, marginBottom: 3 }]}>{cm.name}</Text>
                    <Text style={[Type.body, { color: T.text, lineHeight: 20 }]}>{cm.text}</Text>
                  </View>
                ))}
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
                {photos.map((uri, i) => (
                  <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} contentFit="cover" transition={200} />
                ))}
              </ScrollView>
            ) : null}
          </Animated.View>

          {guest ? <View style={{ height: 2 }} /> : null}
        </View>
      </ScrollView>
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
  bubble: { borderRadius: Radius.md, padding: 12, borderWidth: StyleSheet.hairlineWidth * 2 },
  input: { flex: 1, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth * 2, fontSize: 14 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  addPhoto: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  photo: { width: 100, height: 100, borderRadius: Radius.md },
});
