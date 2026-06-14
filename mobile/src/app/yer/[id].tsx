import React, { useCallback, useEffect, useState } from "react";
import { Alert, Dimensions, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Type, glow } from "@/theme/aurora";
import { API_BASE, fetchPlaceBySlug, getCachedPlace, placeImageFor, type ApiPlace } from "@/lib/api";
import { getDeviceId } from "@/lib/profileSync";
import {
  fetchEventComments,
  postEventComment,
  editEventComment,
  deleteEventComment,
  reactEventComment,
  type EventComment,
} from "@/lib/eventComments";
import { CommentThread } from "@/components/CommentThread";
import { ReplyComposerBar } from "@/components/ReplyComposerBar";
import { eventToThread, type ThreadComment } from "@/lib/commentThread";
import { useMentionField } from "@/lib/mentions";
import { MentionSuggestions } from "@/components/MentionSuggestions";
import {
  fetchEventPhotos,
  postEventPhoto,
  deleteEventPhoto as apiDeleteEventPhoto,
  type EventPhoto,
} from "@/lib/eventPhotos";
import { addStory, useStories } from "@/lib/stories";
import { uploadImage } from "@/lib/social";
import { Badge, Loader } from "@/ui/atoms";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { ImageEditor } from "@/components/ImageEditor";
import { EventStoryStrip, mockStoryContributors, personToGroup } from "@/components/EventStoryStrip";
import { EventStoryViewer, type StoryGroup } from "@/components/EventStoryViewer";
import { ZoomableImage } from "@/components/ZoomableImage";
import { showAuthPrompt } from "@/lib/authPrompt";
import { tapH, impactH, successH } from "@/lib/haptics";

const { width } = Dimensions.get("window");
const EDIT_WINDOW_MS = 2 * 60 * 1000;

const TYPE_LABEL: Record<string, string> = {
  MUZE: "Müze",
  OREN_YERI: "Örenyeri",
  SARAY: "Saray & Köşk",
  DIGER: "Gezilecek Yer",
};

/** Zaman damgası → kısa göreli etiket. */
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "az önce";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} saat önce`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} gün önce`;
  const d = new Date(ts);
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

interface Photo { id: string; uri: string; by: string; ts: number }
function toPhoto(ep: EventPhoto): Photo {
  return { id: ep.id, uri: ep.url, by: ep.deviceId, ts: Date.parse(ep.createdAt) || Date.now() };
}

interface Story { uri: string; caption: string; eventSlug: string; ts: number; eventTitle?: string; city?: string }

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  const GRAD = T.primaryGradient;

  const [place, setPlace] = useState<ApiPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState("");

  const [comments, setComments] = useState<EventComment[]>([]);
  const [replyTo, setReplyTo] = useState<ThreadComment | null>(null);
  const [draft, setDraft] = useState("");
  const mention = useMentionField(draft, setDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);

  // story akışı
  const [storyUri, setStoryUri] = useState<string | null>(null);
  const [storySrcModal, setStorySrcModal] = useState(false);
  const [storyShared, setStoryShared] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [viewerGroups, setViewerGroups] = useState<StoryGroup[] | null>(null);
  const [viewerStart, setViewerStart] = useState(0);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [seenStoryIds, setSeenStoryIds] = useState<Set<string>>(new Set());
  const { stories, reload: reloadStories, remove: removeStory } = useStories();

  const slug = String(id);

  useEffect(() => {
    const cached = getCachedPlace(slug);
    if (cached) { setPlace(cached); setLoading(false); return; }
    fetchPlaceBySlug(slug).then((p) => { setPlace(p); setLoading(false); });
  }, [slug]);

  useEffect(() => { getDeviceId().then(setMyDeviceId).catch(() => {}); }, []);
  useEffect(() => { AsyncStorage.getItem("meydanfest:avatar").then((v) => setAvatarOverride(v ?? null)); }, []);
  useEffect(() => {
    AsyncStorage.getItem("meydanfest:seenStories").then((v) => {
      if (v) { try { setSeenStoryIds(new Set(JSON.parse(v) as string[])); } catch { /* yoksay */ } }
    }).catch(() => {});
  }, []);
  const markStorySeen = useCallback((sid: string) => {
    if (!sid) return;
    setSeenStoryIds((prev) => {
      if (prev.has(sid)) return prev;
      const next = new Set(prev); next.add(sid);
      AsyncStorage.setItem("meydanfest:seenStories", JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  // yer slug'ı (yer-...) ile yorum + foto çek — event uçlarıyla AYNI (slug-bazlı).
  useEffect(() => {
    if (!place?.slug) return;
    let alive = true;
    fetchEventComments(place.slug).then((list) => { if (alive) setComments(list); });
    fetchEventPhotos(place.slug).then((list) => { if (alive) setPhotos(list.map(toPhoto)); });
    return () => { alive = false; };
  }, [place?.slug]);

  useEffect(() => {
    if (!storyShared) return;
    const tm = setTimeout(() => setStoryShared(false), 2200);
    return () => clearTimeout(tm);
  }, [storyShared]);

  // ── Yorum aksiyonları ──
  const startEditComment = (c: ThreadComment) => { tapH(); setReplyTo(null); setEditingId(c.id); setDraft(c.text); };
  const onReplyComment = (c: ThreadComment) => { tapH(); setEditingId(null); setReplyTo(c); };
  const saveEditComment = async () => {
    const text = draft.trim(); const cid = editingId;
    if (!cid || !text) { setEditingId(null); setDraft(""); return; }
    setEditingId(null); setDraft(""); mention.clear();
    const r = await editEventComment(cid, text);
    if (r.ok && r.comment) { const updated = r.comment; setComments((prev) => prev.map((c) => (c.id === cid ? updated : c))); successH(); }
    else { setDraft(text); setEditingId(cid); }
  };
  const handleDeleteComment = async (c: ThreadComment) => {
    const r = await deleteEventComment(c.id, !!user && isAdmin(user));
    if (r.ok) { setComments((prev) => prev.filter((x) => x.id !== c.id)); successH(); }
  };
  const onReactComment = async (commentId: string, emoji: string) => {
    await reactEventComment(commentId, emoji);
    if (place?.slug) setComments(await fetchEventComments(place.slug));
  };
  const sendComment = async () => {
    if (editingId) { void saveEditComment(); return; }
    if (!user) { showAuthPrompt(t("login_required")); return; }
    const text = draft.trim();
    if (!text || !place?.slug) return;
    tapH(); setDraft(""); mention.clear();
    const replyToId = replyTo?.id ?? null; setReplyTo(null);
    const created = await postEventComment({ eventSlug: place.slug, authorName: user.name, avatar: avatarOverride ?? null, text, replyToId });
    if (created) setComments(await fetchEventComments(place.slug));
    else setDraft(text);
  };

  // ── Foto ──
  const addPhoto = async () => {
    if (!user) { showAuthPrompt(t("lock_photo_title")); return; }
    impactH();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.length) return;
    const uploaded = await uploadImage(res.assets[0].uri, "post");
    if (!uploaded || !place?.slug) { Alert.alert("Fotoğraf", "Fotoğraf yüklenemedi. Bağlantını kontrol et."); return; }
    const created = await postEventPhoto(place.slug, uploaded);
    if (created) { setPhotos((prev) => [...prev, toPhoto(created)]); successH(); }
    else Alert.alert("Fotoğraf", "Fotoğraf kaydedilemedi. Tekrar dene.");
  };
  const canDeletePhoto = (p: Photo) => (!!myDeviceId && p.by === myDeviceId) || (!!user && isAdmin(user));
  const deletePhoto = (index: number) => {
    const p = photos[index];
    if (!p || !canDeletePhoto(p)) return;
    tapH();
    Alert.alert(t("delete_photo_q"), undefined, [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: async () => {
        const r = await apiDeleteEventPhoto(p.id, !!user && isAdmin(user));
        if (r.ok) { setPhotos((prev) => prev.filter((x) => x.id !== p.id)); successH(); }
        else Alert.alert(t("delete"), "Fotoğraf silinemedi.");
      } },
    ]);
  };

  // ── Story ──
  const pickStoryFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Kamera izni gerekli", "Story çekmek için kamera iznine ihtiyaç var."); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !res.assets?.length) return;
    setStoryUri(res.assets[0].uri);
  };
  const pickStoryFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Galeri izni gerekli", "Story seçmek için galeri iznine ihtiyaç var."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.length) return;
    setStoryUri(res.assets[0].uri);
  };
  const pickStory = () => {
    if (!user) { showAuthPrompt(t("lock_story_title")); return; }
    impactH(); setStorySrcModal(true);
  };
  const chooseStorySource = (source: "camera" | "library") => {
    tapH(); setStorySrcModal(false);
    if (source === "camera") void pickStoryFromCamera();
    else void pickStoryFromLibrary();
  };
  const onStoryEdited = async (editedUri: string) => {
    if (!place) { setStoryUri(null); return; }
    setStoryUri(null); setUploadingStory(true);
    try {
      const story: Story = { uri: editedUri, caption: "", eventSlug: place.slug, ts: Date.now(), eventTitle: place.name, city: place.city };
      await addStory(story);
      try {
        const deviceId = await getDeviceId();
        await fetch(`${API_BASE}/api/stories`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
          body: JSON.stringify({ deviceId, eventSlug: place.slug, caption: "" }),
        });
      } catch { /* yok say */ }
      successH(); setStoryShared(true); reloadStories();
    } finally { setUploadingStory(false); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: T.bg }}><Loader /></View>;
  if (!place) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Text style={[Type.h2, { color: T.text }]}>Yer bulunamadı</Text>
        <Pressable onPress={() => { tapH(); router.back(); }}><Text style={{ color: T.primary }}>← {t("back")}</Text></Pressable>
      </View>
    );
  }

  const heroUri = placeImageFor(place);
  const hours = place.open_time && place.close_time ? `${place.open_time} – ${place.close_time}` : place.open_time ?? null;
  const myPhoto = avatarOverride || user?.photo || "";

  // ── Story grupları (event ekranıyla aynı kurgu) ──
  const myEventStories = stories.filter((s) => s.eventSlug === place.slug);
  const myGroup: StoryGroup | null = myEventStories.length > 0 ? {
    id: "__me", name: user?.name || "Sen", avatar: myPhoto, isMe: true,
    segments: [...myEventStories].reverse().map((s) => ({ uri: s.uri, caption: s.caption || undefined, eventTitle: s.eventTitle || place.name, city: s.city || place.city })),
  } : null;
  const mockGroupsRaw: StoryGroup[] = mockStoryContributors(`${place.slug}:${place.id}`).map(personToGroup);
  const mockGroups: StoryGroup[] = [
    ...mockGroupsRaw.filter((g) => !seenStoryIds.has(g.id)),
    ...mockGroupsRaw.filter((g) => seenStoryIds.has(g.id)),
  ];
  const storyGroups: StoryGroup[] = [...(myGroup ? [myGroup] : []), ...mockGroups];
  const openStoryViewer = (index: number) => {
    tapH();
    const g = storyGroups[index];
    if (g && (!myGroup || g.id !== myGroup.id)) markStorySeen(g.id);
    setViewerStart(index); setViewerGroups(storyGroups);
  };

  const openMap = () => {
    tapH();
    const q = encodeURIComponent(`${place.name} ${place.city}`.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };
  const openLink = (raw: string) => { impactH(); const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^@/, "")}`; WebBrowser.openBrowserAsync(url); };
  const callPhone = () => { tapH(); if (place.phone) Linking.openURL(`tel:${place.phone.replace(/\s+/g, "")}`); };
  const prettyLink = (u: string) => u.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const share = () => {
    impactH();
    const url = `${API_BASE}/yer/${place.slug}`;
    const message = `🏛️ ${place.name}\n📍 ${place.city}\n${hours ? `🕘 ${hours}\n` : ""}\n👉 ${url}\n\n— Meydan'da keşfettim ✨`;
    Share.share({ message, url }, { dialogTitle: `${place.name} — paylaş` });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Hero */}
        <View style={{ height: width * 1.05 }}>
          {imgFailed ? (
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ fontSize: 90 }}>🏛️</Text>
            </LinearGradient>
          ) : (
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { tapH(); setZoom(true); }}>
              <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} onError={() => setImgFailed(true)} />
            </Pressable>
          )}
          <LinearGradient colors={["rgba(8,7,13,0.5)", "transparent", "rgba(8,7,13,0.6)", T.bg]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            <Pressable onPress={() => { tapH(); router.back(); }} style={[styles.circleBtn, { borderColor: T.hairline }]}><Text style={styles.circleTxt}>←</Text></Pressable>
            <Pressable onPress={share} style={[styles.circleBtn, { borderColor: T.hairline }]}><Ionicons name="share-social-outline" size={17} color="#fff" /></Pressable>
          </View>
          <View style={styles.heroInfo}>
            <Badge text={TYPE_LABEL[place.type] ?? "Gezilecek Yer"} color={GRAD[0]} style={{ alignSelf: "flex-start", marginBottom: 10 }} />
            <Text style={[Type.hero, { color: "#fff" }]}>{place.name}</Text>
          </View>
        </View>

        {/* Bilgi kartı */}
        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 6 }}>
          <Animated.View entering={FadeInDown.duration(450)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <InfoRow T={T} icon="🏷️" label="Tür" value={TYPE_LABEL[place.type] ?? "Gezilecek Yer"} />
            <View style={[styles.sep, { backgroundColor: T.hairline }]} />
            <InfoRow T={T} icon="📍" label="Konum" value={place.district ? `${place.district}, ${place.city}` : place.city} onPress={openMap} actionLabel="Haritada gör" />
            {hours ? (<><View style={[styles.sep, { backgroundColor: T.hairline }]} /><InfoRow T={T} icon="🕘" label="Ziyaret saatleri" value={hours} /></>) : null}
            {place.address ? (<><View style={[styles.sep, { backgroundColor: T.hairline }]} /><InfoRow T={T} icon="🏛️" label="Adres" value={place.address} onPress={openMap} actionLabel="Haritada gör" /></>) : null}
            {place.phone ? (<><View style={[styles.sep, { backgroundColor: T.hairline }]} /><InfoRow T={T} icon="📞" label="Telefon" value={place.phone} onPress={callPhone} actionLabel="Ara" /></>) : null}
            {place.website ? (<><View style={[styles.sep, { backgroundColor: T.hairline }]} /><InfoRow T={T} icon="🌐" label="Web sitesi" value={prettyLink(place.website)} onPress={() => openLink(place.website!)} actionLabel="Aç" /></>) : null}
          </Animated.View>

          {place.description ? (
            <Animated.View entering={FadeInDown.duration(450).delay(60)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
              <Text style={[Type.label, { color: T.textFaint, marginBottom: 8 }]}>Hakkında</Text>
              <Text style={[Type.body, { color: T.textDim, lineHeight: 22 }]}>{place.description}</Text>
            </Animated.View>
          ) : null}

          {/* Story şeridi + paylaş */}
          <Animated.View entering={FadeInDown.duration(450).delay(180)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>✨ Bu yerin story'leri</Text>
            <EventStoryStrip myGroup={myGroup} mockGroups={mockGroups} onOpen={openStoryViewer} onShare={pickStory} uploading={uploadingStory} seenIds={seenStoryIds} />
          </Animated.View>

          {/* Yorumlar */}
          <Animated.View entering={FadeInDown.duration(450).delay(240)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>Yorumlar</Text>
            {comments.length === 0 ? (
              <Text style={[Type.body, { color: T.textFaint, marginBottom: 14 }]}>{t("no_comments")}</Text>
            ) : (
              <View style={{ marginBottom: 14 }}>
                <CommentThread
                  comments={comments.map(eventToThread)}
                  myDeviceId={myDeviceId}
                  isAdmin={!!user && isAdmin(user)}
                  editWindowMs={EDIT_WINDOW_MS}
                  onReact={onReactComment}
                  onReply={onReplyComment}
                  onEdit={startEditComment}
                  onDelete={handleDeleteComment}
                />
              </View>
            )}
            <MentionSuggestions users={mention.results} onPick={mention.pick} />
            {editingId ? (
              <View style={[styles.composerBar, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
                <Text style={[Type.micro, { color: T.primary, fontWeight: "700", flex: 1 }]}>✏️ Yorumu düzenliyorsun</Text>
                <Pressable onPress={() => { setEditingId(null); setDraft(""); }} hitSlop={10}><Text style={{ fontSize: 18, color: T.textDim }}>✕</Text></Pressable>
              </View>
            ) : replyTo ? (
              <ReplyComposerBar authorName={replyTo.authorName} snippet={replyTo.text} onCancel={() => setReplyTo(null)} />
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={draft}
                onChangeText={mention.onChangeText}
                placeholder={editingId ? t("edit") : replyTo ? `${replyTo.authorName}'e yanıt yaz…` : t("write_comment")}
                placeholderTextColor={T.textFaint}
                style={[styles.input, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
                onSubmitEditing={sendComment}
                returnKeyType="send"
              />
              <Pressable onPress={sendComment} disabled={!draft.trim()} style={{ borderRadius: Radius.pill, overflow: "hidden", opacity: draft.trim() ? 1 : 0.5 }}>
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
                  <Text style={[Type.label, { color: "#fff" }]}>{editingId ? t("save") : t("send")}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>

          {/* Foto */}
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
                  <View key={`${p.uri}-${i}`} style={{ gap: 4 }}>
                    <View>
                      <Image source={{ uri: p.uri }} style={styles.photo} contentFit="cover" transition={200} />
                      {canDeletePhoto(p) ? (
                        <Pressable onPress={() => deletePhoto(i)} hitSlop={8} style={styles.photoDel}><Text style={{ fontSize: 13 }}>🗑️</Text></Pressable>
                      ) : null}
                    </View>
                    {p.ts ? <Text style={[Type.micro, { color: T.textFaint, maxWidth: styles.photo.width, textAlign: "center" }]} numberOfLines={1}>{relTime(p.ts)}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Story kaynak modalı */}
      <Modal visible={storySrcModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setStorySrcModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setStorySrcModal(false)} />
        <View style={[styles.sheet, { backgroundColor: T.bgElevated, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: T.hairline }]} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <Text style={[Type.h2, { color: T.text }]}>✨ Story paylaş</Text>
            <Pressable onPress={() => { tapH(); setStorySrcModal(false); }} hitSlop={10}><Text style={{ color: T.textDim, fontSize: 22 }}>✕</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={() => chooseStorySource("camera")} style={[styles.storySrcOpt, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storySrcIcon}><Text style={{ fontSize: 28 }}>📷</Text></LinearGradient>
              <Text style={[Type.title, { color: T.text }]}>Kamera</Text>
            </Pressable>
            <Pressable onPress={() => chooseStorySource("library")} style={[styles.storySrcOpt, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.storySrcIcon}><Text style={{ fontSize: 28 }}>🖼️</Text></LinearGradient>
              <Text style={[Type.title, { color: T.text }]}>Galeri</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => { tapH(); setStorySrcModal(false); }} style={[styles.storySrcCancel, { borderColor: T.hairline, backgroundColor: T.surface }]}>
            <Text style={[Type.label, { color: T.textDim }]}>İptal</Text>
          </Pressable>
        </View>
      </Modal>

      {storyUri ? (
        <ImageEditor uri={storyUri} outWidth={1080} title="Story" noCrop onDone={(u) => { void onStoryEdited(u); }} onCancel={() => setStoryUri(null)} />
      ) : null}

      {viewerGroups ? (
        <EventStoryViewer
          groups={viewerGroups}
          startIndex={viewerStart}
          onClose={() => setViewerGroups(null)}
          onDeleteSegment={(gi, si) => {
            const g = viewerGroups[gi];
            if (!g?.isMe) return;
            const seg = [...myEventStories].reverse()[si];
            if (!seg) return;
            void (async () => { await removeStory(seg.ts); reloadStories(); setViewerGroups(null); })();
          }}
        />
      ) : null}

      {!imgFailed ? <ZoomableImage uri={heroUri} visible={zoom} onClose={() => setZoom(false)} /> : null}

      <Modal visible={storyShared} transparent animationType="none" statusBarTranslucent onRequestClose={() => setStoryShared(false)}>
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(220)} style={styles.successScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setStoryShared(false)} />
          <Animated.View entering={ZoomIn.springify().damping(13).mass(0.7)} style={[styles.successCard, { backgroundColor: T.bgElevated, borderColor: T.hairline }, glow(GRAD[0], 28, 0.5)]}>
            <View style={styles.successRingWrap}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successRing}>
                <Animated.Text entering={ZoomIn.delay(140).springify().damping(10)} style={styles.successCheck}>✓</Animated.Text>
              </LinearGradient>
            </View>
            <Text style={[Type.h2, { color: T.text, marginTop: 16, textAlign: "center" }]}>Story paylaşıldı! 🎉</Text>
            <Pressable onPress={() => { tapH(); setStoryShared(false); }} style={{ marginTop: 18, borderRadius: Radius.pill, overflow: "hidden" }}>
              <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successBtn}><Text style={[Type.label, { color: "#fff" }]}>Harika</Text></LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

function InfoRow({ T, icon, label, value, onPress, actionLabel }: { T: Palette; icon: string; label: string; value: string; onPress?: () => void; actionLabel?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.infoRow}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[Type.label, { color: T.textFaint }]}>{label}</Text>
        <Text style={[Type.title, { color: T.text }]}>{value}</Text>
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
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: 16, paddingTop: 10 },
  sheetHandle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 14 },
  input: { flex: 1, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth * 2, fontSize: 14 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  composerBar: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2 },
  addPhoto: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  photo: { width: 100, height: 100, borderRadius: Radius.md },
  photoDel: { position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  storySrcOpt: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 22, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  storySrcIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  storySrcCancel: { marginTop: 16, paddingVertical: 13, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center", justifyContent: "center" },
  successScrim: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 32 },
  successCard: { width: "100%", maxWidth: 340, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22, alignItems: "center" },
  successRingWrap: { width: 104, height: 104, alignItems: "center", justifyContent: "center" },
  successRing: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  successCheck: { color: "#fff", fontSize: 44, fontWeight: "900", marginTop: -2 },
  successBtn: { paddingHorizontal: 32, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
});
