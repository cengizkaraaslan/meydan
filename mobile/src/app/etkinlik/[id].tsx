import React, { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Dimensions, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
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
import { fmtLong, priceLabel, isUniversitySource } from "@/lib/format";
import { API_BASE, fetchEventById, imageFor, type ApiEvent } from "@/lib/api";
import { getDeviceId } from "@/lib/profileSync";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { setAttending, mockAttendeesFor } from "@/lib/attending";
import { addStory, useStories } from "@/lib/stories";
import { uploadImage, createPost } from "@/lib/social";
import { Badge, Loader, Pill } from "@/ui/atoms";
import { useTheme, type Palette } from "@/lib/theme";
import { useCanSeeAges } from "@/lib/dprofile";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { PEOPLE, type Person } from "@/lib/people";
import { StoryAvatar } from "@/components/StoryAvatar";
import { ImageEditor } from "@/components/ImageEditor";
import { AttendeeListModal } from "@/components/AttendeeListModal";
import { EventStoryStrip, mockStoryContributors, personToGroup } from "@/components/EventStoryStrip";
import { EventStoryViewer, type StoryGroup } from "@/components/EventStoryViewer";
import { EventTweets } from "@/components/EventTweets";
import { ZoomableImage } from "@/components/ZoomableImage";
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

/**
 * Etkinlik koordinatı yok → id'den DETERMİNİSTİK yaklaşık mesafe üret (Math.random YOK).
 * Aynı etkinlik her açılışta aynı mesafeyi gösterir. ~0.3–12 km arası.
 */
function approxDistance(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  // 300 m – 12000 m arası deterministik mesafe
  const meters = 300 + (h % 11700);
  if (meters < 1000) return `${meters} m yakınında`;
  return `${(meters / 1000).toFixed(1)} km yakınında`;
}

interface Story {
  uri: string;
  caption: string;
  eventSlug: string;
  ts: number;
  eventTitle?: string;
  city?: string;
}

// Türkçe tam gün isimleri (Date.getDay(): 0 Pazar … 6 Cumartesi).
const WEEKDAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** Verilen ISO tarihin Türkçe tam gün adı (örn. "Cumartesi"). */
function weekdayTR(iso: string): string {
  return WEEKDAYS_TR[new Date(iso).getDay()];
}

/**
 * Yakın tarihler için göreli vurgu etiketi (yerel saat). UZAK/geçmiş tarihlerde null.
 * Bugün/Yarın; ≤7 gün içindeyse: Cmt/Paz "Bu hafta sonu", değilse "<Gün adı>";
 * 2-7 gün arası fallback "X gün sonra". >7 gün ya da geçmiş → null (etiket gösterme).
 */
function relativeDateLabel(iso: string): string | null {
  const target = new Date(iso);
  if (isNaN(target.getTime())) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  if (dayDiff < 0) return null; // geçmiş
  if (dayDiff === 0) return "Bugün";
  if (dayDiff === 1) return "Yarın";
  if (dayDiff > 7) return null; // uzak
  const dow = startOfTarget.getDay(); // 0 Paz … 6 Cmt
  if (dow === 6 || dow === 0) return "Bu hafta sonu";
  return WEEKDAYS_TR[dow]; // örn. "Perşembe"
}

export default function EventDetail() {
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
  const insets = useSafeAreaInsets();
  const { ids } = useFavorites();
  const { t: T } = useTheme();
  const { t } = useT();
  const canSeeAges = useCanSeeAges();
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
  // Hero kapak görseline dokununca açılan tam ekran pinch-zoom modal'ı.
  const [zoom, setZoom] = useState(false);

  // #18 — hava durumu
  const [weather, setWeather] = useState<DayWeather | null>(null);

  // story paylaşma akışı — seçilen/çekilen foto editöre verilir; editör onDone'da ANINDA paylaşılır.
  const [storyUri, setStoryUri] = useState<string | null>(null);
  // duvara (Meydan feed) foto paylaşma durumu
  const [wallPosting, setWallPosting] = useState(false);

  // katılacaklar listesi modal'ı (eski tek liste — korunuyor)
  const [listOpen, setListOpen] = useState(false);
  // RSVP kategorisi başına kişi listesi modal'ı (going/maybe/interested); null = kapalı
  const [catOpen, setCatOpen] = useState<Rsvp | null>(null);
  // Katılımcı kartındaki aktif sekme (going/maybe/interested)
  const [attTab, setAttTab] = useState<Rsvp>("going");
  // Çoklu-segment story izleyici: açık olduğunda gösterilecek gruplar + başlangıç indeksi.
  const [viewerGroups, setViewerGroups] = useState<StoryGroup[] | null>(null);
  const [viewerStart, setViewerStart] = useState(0);
  // avatara dokun/basılı tut → fotoğrafı büyütme modal'ı (uri)
  const [photoView, setPhotoView] = useState<string | null>(null);
  // profil avatar override'ı (benim story halkam için): "meydanfest:avatar" ?? user?.photo
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  // kullanıcı cinsiyeti (foto yokken default avatar ikonunu seçer): "male" | "female" | null
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  // bu etkinliğe ait benim story'lerim (reaktif)
  const { stories, reload: reloadStories, remove: removeStory } = useStories();

  // Etkinlik detaydan geri dönerken ömür boyu 1 kez gösterilen "yardım" modalı.
  const [leaveHelp, setLeaveHelp] = useState(false);
  // seen değeri mount'ta okunur ve ref'te tutulur ("1" = daha önce gösterildi).
  const leaveHelpSeen = useRef(false);
  const LEAVE_HELP_KEY = "meydanfest:leaveHelpSeen";

  useEffect(() => {
    AsyncStorage.getItem(LEAVE_HELP_KEY).then((v) => {
      leaveHelpSeen.current = v === "1";
    });
  }, []);

  // Geri gitme denemesi: daha önce görüldüyse normal geri; değilse modalı 1 kez göster.
  const tryLeave = () => {
    if (leaveHelpSeen.current) {
      router.back();
      return;
    }
    leaveHelpSeen.current = true;
    AsyncStorage.setItem(LEAVE_HELP_KEY, "1");
    setLeaveHelp(true);
  };

  // Android donanım geri tuşu:
  //  - modal açıkken → modalı kapat (geri gitme).
  //  - modal yokken → tryLeave (seen değilse modal aç, seen ise normal geri).
  useEffect(() => {
    const onBack = () => {
      if (leaveHelp) {
        setLeaveHelp(false);
        return true; // default geri'yi engelle
      }
      if (!leaveHelpSeen.current) {
        tryLeave();
        return true; // modalı açtık, default geri'yi engelle
      }
      return false; // seen → normal geri
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [leaveHelp]);

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

  // benim story halkam için profil avatarını yükle
  useEffect(() => {
    AsyncStorage.getItem("meydanfest:avatar").then((v) => setAvatarOverride(v ?? null));
  }, []);

  // foto yokken cinsiyete göre default avatar için cinsiyeti yükle
  useEffect(() => {
    AsyncStorage.getItem("meydanfest:gender").then((v) =>
      setGender(v === "male" || v === "female" ? v : null),
    );
  }, []);

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

  // story foto kaynağı: kamera → seçilen uri editöre verilir (storyUri set edilir).
  const pickStoryFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Kamera izni gerekli", "Story çekmek için kamera iznine ihtiyaç var.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled || !res.assets?.length) return;
    setStoryUri(res.assets[0].uri);
  };

  // story foto kaynağı: galeri → seçilen uri editöre verilir (storyUri set edilir).
  const pickStoryFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Galeri izni gerekli", "Story seçmek için galeri iznine ihtiyaç var.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    setStoryUri(res.assets[0].uri);
  };

  // story: PRATİK akış → kaynak seç (Kamera/Galeri) → ImageEditor → onDone'da ANINDA paylaş.
  // Caption yok, geri/iptal karmaşası yok.
  const pickStory = () => {
    // Oturum açmayan story yükleyemez → giriş modalı (akışı kilitlemez, sadece bilgilendirir).
    if (!user) {
      showAuthPrompt(t("lock_story_title"));
      return;
    }
    impactH();
    Alert.alert("Story paylaş", "Fotoğraf kaynağını seç", [
      { text: "📷 Kamera", onPress: () => { void pickStoryFromCamera(); } },
      { text: "🖼️ Galeri", onPress: () => { void pickStoryFromLibrary(); } },
      { text: "İptal", style: "cancel" },
    ]);
  };

  // Editör 'Bitir'e basınca: ANINDA addStory (caption boş) + etkinlik adı/konum ile + reload.
  const onStoryEdited = async (editedUri: string) => {
    if (!event) { setStoryUri(null); return; }
    setStoryUri(null); // editörü kapat
    const story: Story = {
      uri: editedUri,
      caption: "",
      eventSlug: event.slug,
      ts: Date.now(),
      eventTitle: event.title,
      city: event.city,
    };
    await addStory(story); // R2'ye yükler + DB'ye kaydeder (reaktif → her ekranda anında)
    // best-effort API (varsa /api/stories; yoksa sadece local kalır)
    try {
      const deviceId = await getDeviceId();
      await fetch(`${API_BASE}/api/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "meydanfest-app" },
        body: JSON.stringify({ deviceId, eventSlug: event.slug, caption: "" }),
      });
    } catch {
      /* yok say */
    }
    successH();
    Alert.alert("Story paylaşıldı ✓", "Story'in bu etkinlikte yayında.");
    reloadStories(); // şerit anında güncellensin
  };

  // 📷 Duvara paylaş: bu etkinlikte çekilen/seçilen fotoğraf Meydan duvarına (feed) düşer.
  // Story paylaşımından AYRI bir aksiyon — mevcut akışı bozmaz.
  const postPhotoToWall = async (uri: string) => {
    if (!event) return;
    setWallPosting(true);
    try {
      const imageUrl = await uploadImage(uri, "post");
      if (!imageUrl) {
        Alert.alert("Yüklenemedi", "Fotoğraf yüklenemedi, tekrar dene.");
        return;
      }
      const avatar = await AsyncStorage.getItem("meydanfest:avatar");
      const ok = await createPost({
        imageUrl,
        eventSlug: event.slug,
        eventTitle: event.title,
        authorName: user?.name || undefined,
        authorAvatar: avatar || undefined,
      });
      if (ok) {
        successH();
        Alert.alert("Duvarda paylaşıldı ✓", "Fotoğrafın Meydan duvarına düştü.");
      } else {
        Alert.alert("Paylaşılamadı", "Gönderi paylaşılamadı, tekrar dene.");
      }
    } finally {
      setWallPosting(false);
    }
  };

  // Duvara paylaş: kaynak seç (Kamera / Galeri) → R2 → createPost.
  const shareToWall = () => {
    // Oturum açmayan duvara paylaşamaz → giriş modalı.
    if (!user) {
      showAuthPrompt(t("lock_photo_title"));
      return;
    }
    if (wallPosting) return;
    impactH();
    Alert.alert("Duvarda paylaş", "Fotoğraf kaynağını seç", [
      {
        text: "📷 Kamera",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Kamera izni gerekli", "Fotoğraf çekmek için kamera iznine ihtiyaç var.");
            return;
          }
          const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (res.canceled || !res.assets?.length) return;
          await postPhotoToWall(res.assets[0].uri);
        },
      },
      {
        text: "🖼️ Galeri",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Galeri izni gerekli", "Fotoğraf seçmek için galeri iznine ihtiyaç var.");
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
          if (res.canceled || !res.assets?.length) return;
          await postPhotoToWall(res.assets[0].uri);
        },
      },
      { text: "İptal", style: "cancel" },
    ]);
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
  // Kullanıcının kendi Person'u ("Sen") — herhangi bir kategori önizlemesinde başa eklenebilir.
  // Benim gerçek fotoğrafım: önce profil override, sonra Google foto. İkisi de yoksa null
  // (→ foto yerine cinsiyete göre emoji-daire gösterilir).
  const myPhoto = avatarOverride || user?.photo || "";
  // Foto yokken gösterilecek cinsiyet ikonu (👨 erkek / 👩 kadın / 👤 bilinmiyor).
  const genderEmoji = gender === "male" ? "👨" : gender === "female" ? "👩" : "👤";
  const buildMePerson = (): Person => ({
    id: "__me",
    name: user?.name || "Sen",
    age: 0,
    city: event.city,
    distanceKm: 0,
    online: true,
    // Boş bırakılırsa render tarafı emoji-daire gösterir (kırık/sahte foto yerine).
    avatar: myPhoto,
    bio: "",
    interests: [],
    gender: gender ?? "male",
  });
  const meAttendee: Person | null = rsvp === "going" && user ? buildMePerson() : null;
  const attendeeList = meAttendee ? [meAttendee, ...PEOPLE] : PEOPLE;
  const attendees = attendeeList.slice(0, 6);
  const extraAttendees = Math.max(0, attendeeList.length - attendees.length);

  // #RSVP — her kategori için DETERMİNİSTİK (etkinlik id'sine göre sabit) mock kişi listesi.
  // Math.random YOK → her açılışta aynı kişiler. Kategoriler farklı dilimler alır.
  const goingPeople = mockAttendeesFor(eid, "going", PEOPLE);
  const maybePeople = mockAttendeesFor(eid, "maybe", PEOPLE);
  const interestedPeople = mockAttendeesFor(eid, "interested", PEOPLE);
  const catPeople: Record<Rsvp, Person[]> = {
    going: goingPeople,
    maybe: maybePeople,
    interested: interestedPeople,
  };
  // Kategori sayımı: yapay "+1 ben" yok — yalnızca mock liste boyutu.
  const catCount = (cat: Rsvp) => catPeople[cat].length;
  // Bir kategorinin önizleme listesi: kendini başa ekleme (yapay +1 üretmesin).
  const peopleForCat = (cat: Rsvp): Person[] => catPeople[cat];

  // ── Story şeridi grupları ──
  // Benim bu etkinliğe ait story'lerim → tek grup (avatar: profil override ?? user.photo).
  const myEventStories = stories.filter((s) => s.eventSlug === event.slug);
  const myAvatar = myPhoto;
  const myGroup: StoryGroup | null =
    myEventStories.length > 0
      ? {
          id: "__me",
          name: user?.name || "Sen",
          avatar: myAvatar,
          isMe: true,
          // En yeniden eskiye → kronolojik göstermek için ters çevir.
          segments: [...myEventStories].reverse().map((s) => ({
            uri: s.uri,
            caption: s.caption || undefined,
            // Story üzerinde etkinlik adı/konum gösterimi için (viewer kullanır).
            eventTitle: s.eventTitle || event.title,
            city: s.city || event.city,
          })),
        }
      : null;
  // Mock katkıda bulunanlar (deterministik; slug+id ile sabit).
  const mockGroups: StoryGroup[] = mockStoryContributors(`${event.slug}:${event.id}`).map(personToGroup);
  const storyGroups: StoryGroup[] = [...(myGroup ? [myGroup] : []), ...mockGroups];

  const openStoryViewer = (index: number) => {
    tapH();
    setViewerStart(index);
    setViewerGroups(storyGroups);
  };

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
    setCatOpen(null);
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
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { tapH(); setZoom(true); }}>
              <Image
                source={{ uri: heroUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={350}
                onError={() => setImgFailed(true)}
              />
            </Pressable>
          )}
          <LinearGradient colors={["rgba(8,7,13,0.5)", "transparent", "rgba(8,7,13,0.6)", T.bg]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
          {/* Üst bar */}
          <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
            <Pressable onPress={() => { tapH(); tryLeave(); }} style={[styles.circleBtn, { borderColor: T.hairline }]}><Text style={styles.circleTxt}>←</Text></Pressable>
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
            <InfoRow
              T={T}
              icon="🗓️"
              label={t("date")}
              value={`${fmtLong(event.starts_at)} · ${weekdayTR(event.starts_at)}`}
              badge={relativeDateLabel(event.starts_at)}
              badgeColor={c.gradient[0]}
            />
            <View style={[styles.sep, { backgroundColor: T.hairline }]} />
            <InfoRow T={T} icon="📍" label={t("venue")} value={event.venue || event.city || t("not_specified")} onPress={openMap} actionLabel={t("see_on_map")} />
            <View style={[styles.sep, { backgroundColor: T.hairline }]} />
            <InfoRow T={T} icon="📏" label="Uzaklık" value={approxDistance(eid)} />
            <View style={[styles.sep, { backgroundColor: T.hairline }]} />
            <InfoRow
              T={T}
              icon={isUniversitySource(event.source) ? "🎓" : "🎟️"}
              label={isUniversitySource(event.source) ? "Erişim" : t("ticket")}
              value={priceLabel(event)}
              valueColor={isUniversitySource(event.source) ? T.cyan : event.is_free ? T.success : T.gold}
              onPress={event.ticket_url ? openTicket : undefined}
              actionLabel={event.ticket_url ? (isUniversitySource(event.source) || event.is_free ? t("go_detail") : t("buy_ticket")) : undefined}
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

          {/* Story şeridi + paylaş (Instagram tarzı) */}
          <Animated.View entering={FadeInDown.duration(450).delay(180)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>✨ Bu etkinlik story'leri</Text>
            <EventStoryStrip
              myGroup={myGroup}
              mockGroups={mockGroups}
              onOpen={openStoryViewer}
              onShare={pickStory}
            />

            {/* 📷 Duvarda paylaş — story'den AYRI: fotoğraf Meydan duvarına (feed) düşer. */}
            <Pressable
              onPress={shareToWall}
              disabled={wallPosting}
              style={[styles.wallShareBtn, { borderColor: T.hairline, backgroundColor: T.surfaceStrong, opacity: wallPosting ? 0.6 : 1 }]}
            >
              <Text style={[Type.label, { color: T.text }]}>
                {wallPosting ? "Yükleniyor…" : "📷 Duvarda paylaş"}
              </Text>
            </Pressable>
          </Animated.View>

          {/* #14 — Etkinliğe katılacaklar — sekmeli filtre (going/maybe/interested) */}
          <Animated.View entering={FadeInDown.duration(450).delay(200)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            {/* Sekmeler — 3'ü tek satırda eşit dağılır (flex:1), taşmaz */}
            <View style={styles.rsvpRow}>
              {([
                ["going", "👥 Katılacak"],
                ["maybe", "🤔 Belki"],
                ["interested", "✨ İlgili"],
              ] as [Rsvp, string][]).map(([key, label]) => {
                const active = attTab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => { tapH(); setAttTab(key); }}
                    style={{ flex: 1, borderRadius: Radius.pill, overflow: "hidden" }}
                  >
                    {active ? (
                      <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.attTab}>
                        <Text style={[Type.label, { color: "#fff", fontSize: 11 }]} numberOfLines={1}>{label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.attTab, { backgroundColor: T.surfaceStrong, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: T.hairline }]}>
                        <Text style={[Type.label, { color: T.textDim, fontSize: 11 }]} numberOfLines={1}>{label}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Seçili kategorinin kişileri */}
            {(() => {
              const preview = peopleForCat(attTab);
              const shown = preview.slice(0, 6);
              const extra = Math.max(0, catCount(attTab) - shown.length);
              return (
                <View style={{ marginTop: 14 }}>
                  {preview.length === 0 ? (
                    <Text style={[Type.body, { color: T.textFaint }]}>Henüz kimse yok</Text>
                  ) : (
                    <Pressable
                      onPress={() => { tapH(); setCatOpen(attTab); }}
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {/* Avatarlar + "+N" rozeti TEK satırda; "+N" son avatarın hemen bitiminde. */}
                      {shown.map((p, i) => (
                        <PreviewAvatar
                          key={p.id}
                          T={T}
                          uri={p.avatar || undefined}
                          fallbackEmoji={p.id === "__me" ? genderEmoji : "👤"}
                          marginLeft={i === 0 ? 0 : -12}
                        />
                      ))}
                      {extra > 0 ? (
                        <View style={[styles.plusInline, { backgroundColor: T.primary + "22", borderColor: T.primary, marginLeft: shown.length ? 6 : 0 }]}>
                          <Text style={[Type.label, { color: T.primary, fontWeight: "800" }]}>+{extra}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  )}

                  {/* Katıl kontrolü */}
                  <Pressable
                    onPress={() => chooseRsvp(attTab)}
                    style={[styles.joinBtn, { borderColor: rsvp === attTab ? T.primary : T.hairline, backgroundColor: T.surfaceStrong }]}
                  >
                    <Text style={[Type.label, { color: rsvp === attTab ? T.primary : T.text }]}>
                      {rsvp === attTab ? "✓ Bu listedesin — çık" : "+ Ben de"}
                    </Text>
                  </Pressable>
                </View>
              );
            })()}
          </Animated.View>

          {/* #14 — Yorumlar */}
          <Animated.View entering={FadeInDown.duration(450).delay(240)} style={[styles.infoCard, { backgroundColor: T.surface, borderColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: 12 }]}>Bu etkinlik yorumları</Text>
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

          {/* 𝕏 (Twitter) — sayfanın EN ALTI: bu etkinlik X'te konuşuluyor mu? */}
          <EventTweets title={event.title} />

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
                      if (!isMe && p.hasStory) {
                        // Bu kişiyi tek-segment grup olarak yeni izleyicide aç.
                        setListOpen(false);
                        setViewerStart(0);
                        setViewerGroups([personToGroup(p)]);
                      } else {
                        setPhotoView(p.avatar);
                      }
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
                    <Text style={[Type.title, { color: T.text }]} numberOfLines={1}>{isMe ? `${p.name} · ${t("you") }` : (canSeeAges ? `${p.name}, ${p.age}` : p.name)}</Text>
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

      {/* RSVP kategorisi başına kişi listesi (going/maybe/interested) */}
      <AttendeeListModal
        visible={catOpen === "going"}
        title="👥 Katılacaklar"
        people={goingPeople}
        gradient={c.gradient}
        bottomInset={insets.bottom}
        meLabel={rsvp === "going" ? `✓ ${t("rsvp_going")}` : null}
        onClose={() => setCatOpen(null)}
        onPressPerson={openPerson}
      />
      <AttendeeListModal
        visible={catOpen === "maybe"}
        title="🤔 Belki"
        people={maybePeople}
        gradient={c.gradient}
        bottomInset={insets.bottom}
        meLabel={rsvp === "maybe" ? `🤔 ${t("rsvp_maybe")}` : null}
        onClose={() => setCatOpen(null)}
        onPressPerson={openPerson}
      />
      <AttendeeListModal
        visible={catOpen === "interested"}
        title="✨ İlgileniyorum"
        people={interestedPeople}
        gradient={c.gradient}
        bottomInset={insets.bottom}
        meLabel={rsvp === "interested" ? `✨ ${t("rsvp_interested")}` : null}
        onClose={() => setCatOpen(null)}
        onPressPerson={openPerson}
      />

      {/* Story editör — kaynak seçilince açılır; 'Bitir'de ANINDA paylaşır (caption yok, geri yok). */}
      {storyUri ? (
        <ImageEditor
          uri={storyUri}
          aspect={9 / 16}
          outWidth={1080}
          title="Story"
          onDone={(u) => { void onStoryEdited(u); }}
          onCancel={() => setStoryUri(null)}
        />
      ) : null}

      {/* Çoklu-segment Instagram-tarzı story izleyici (benim story'lerim + mock katkılar + listeden hasStory'li kişi) */}
      {viewerGroups ? (
        <EventStoryViewer
          groups={viewerGroups}
          startIndex={viewerStart}
          onClose={() => setViewerGroups(null)}
          onDeleteSegment={(gi, si) => {
            // Yalnızca AÇILAN grup benim story grubumsa sil.
            const g = viewerGroups[gi];
            if (!g?.isMe) return;
            // Segmentler [...myEventStories].reverse() ile kuruluyor → aynı sırada ts'i bul.
            const seg = [...myEventStories].reverse()[si];
            if (!seg) return;
            void (async () => {
              await removeStory(seg.ts); // useStories.remove → stories.ts removeStory (DB + yerel) + reload
              reloadStories();
              setViewerGroups(null); // izleyiciyi kapat
            })();
          }}
        />
      ) : null}

      {/* Hero kapak görseli — tam ekran pinch/çift-dokunuş zoom modal'ı */}
      {!imgFailed ? (
        <ZoomableImage uri={heroUri} visible={zoom} onClose={() => setZoom(false)} />
      ) : null}

      {/* Avatar fotoğrafını büyütme modal'ı (dokun/basılı tut) */}
      <Modal visible={!!photoView} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPhotoView(null)}>
        <Pressable style={styles.photoModalBg} onPress={() => setPhotoView(null)}>
          {photoView ? <Image source={{ uri: photoView }} style={styles.photoModalImg} contentFit="contain" transition={150} /> : null}
        </Pressable>
      </Modal>

      {/* Geri dönerken ömür boyu 1 kez gösterilen yardım modalı */}
      <Modal
        visible={leaveHelp}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setLeaveHelp(false); router.back(); }}
      >
        {/* Arka plana basınca geri dön */}
        <Pressable style={styles.leaveBackdrop} onPress={() => { setLeaveHelp(false); router.back(); }} />
        <View style={styles.leaveCenter} pointerEvents="box-none">
          <View style={[styles.leaveCard, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}>
            {/* Kapat */}
            <Pressable
              onPress={() => { tapH(); setLeaveHelp(false); router.back(); }}
              hitSlop={10}
              style={styles.leaveClose}
            >
              <Text style={{ color: T.textDim, fontSize: 22 }}>✕</Text>
            </Pressable>

            <Text style={[Type.h2, { color: T.text, textAlign: "center", marginBottom: 8, paddingHorizontal: 18 }]}>
              Etkinliğe yalnız gitmek istemediğin için mi vazgeçtin? 🤔
            </Text>
            <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginBottom: 20 }]}>
              Sana yardımcı olalım — birlikte gitmek daha keyifli!
            </Text>

            {/* Seçenek 1: etkinlik arkadaşı bul */}
            <Pressable
              onPress={() => { tapH(); setLeaveHelp(false); router.push("/(tabs)/kategoriler"); }}
              style={{ borderRadius: Radius.pill, overflow: "hidden", marginBottom: 12 }}
            >
              <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.leaveOpt}>
                <Text style={[Type.title, { color: "#fff" }]}>👯 Etkinlik arkadaşı bul</Text>
              </LinearGradient>
            </Pressable>

            {/* Seçenek 2: etkinlikten sevgili bul */}
            <Pressable
              onPress={() => { tapH(); setLeaveHelp(false); router.push("/esles"); }}
              style={{ borderRadius: Radius.pill, overflow: "hidden", marginBottom: 16 }}
            >
              <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.leaveOpt}>
                <Text style={[Type.title, { color: "#fff" }]}>❤️ Etkinlikten sevgili bul</Text>
              </LinearGradient>
            </Pressable>

            {/* Sade geri dön */}
            <Pressable
              onPress={() => { tapH(); setLeaveHelp(false); router.back(); }}
              style={[styles.leaveBack, { borderColor: T.hairline, backgroundColor: T.surface }]}
            >
              <Text style={[Type.label, { color: T.textDim }]}>Hayır, geri dön</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** RSVP kategorisi sayaç satırı — dokununca o kategorinin kişi listesi açılır. */
function RsvpCountRow({ T, icon, label, count, active, onPress }: { T: Palette; icon: string; label: string; count: number; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.countRow, { backgroundColor: T.surfaceStrong, borderColor: active ? T.primary : T.hairline }]}
    >
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[Type.title, { color: T.text, flex: 1 }]} numberOfLines={1}>{label}</Text>
      <View style={[styles.countBadge, { backgroundColor: T.surface, borderColor: T.hairline }]}>
        <Text style={[Type.label, { color: active ? T.primary : T.textDim }]}>{count}</Text>
      </View>
      <Text style={[Type.label, { color: T.primary }]}>→</Text>
    </Pressable>
  );
}

/**
 * Katılımcı önizleme avatarı. Foto URL'i varsa <Image>, yoksa cinsiyet/ad ikonu
 * gösteren bir daire (örn. "ben" fotosuz olduğunda 👨/👩/👤). marginLeft ile
 * üst üste binme (overlapping) sağlanır.
 */
function PreviewAvatar({
  T,
  uri,
  fallbackEmoji,
  marginLeft,
}: {
  T: Palette;
  uri?: string;
  fallbackEmoji: string;
  marginLeft: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { borderColor: T.bg, marginLeft }]}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.avatarMore, { borderColor: T.bg, backgroundColor: T.surfaceStrong, marginLeft }]}>
      <Text style={{ fontSize: 20 }}>{fallbackEmoji}</Text>
    </View>
  );
}

function InfoRow({ T, icon, label, value, valueColor, onPress, actionLabel, badge, badgeColor }: { T: Palette; icon: string; label: string; value: string; valueColor?: string; onPress?: () => void; actionLabel?: string; badge?: string | null; badgeColor?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.infoRow}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[Type.label, { color: T.textFaint }]}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Text style={[Type.title, { color: valueColor ?? T.text }]}>{value}</Text>
          {badge ? (
            <View style={[styles.dateBadge, { backgroundColor: (badgeColor ?? T.primary) + "22", borderColor: badgeColor ?? T.primary }]}>
              <Text style={[Type.micro, { color: badgeColor ?? T.primary, fontWeight: "800" }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
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
  dateBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  sep: { height: StyleSheet.hairlineWidth * 2, marginVertical: 6 },
  rsvpRow: { flexDirection: "row", gap: 6 },
  attTab: { paddingHorizontal: 6, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  plusInline: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2 },
  countBadge: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center", justifyContent: "center" },
  joinBtn: { marginTop: 14, alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
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
  wallShareBtn: { marginTop: 14, paddingVertical: 11, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center", justifyContent: "center" },
  photo: { width: 100, height: 100, borderRadius: Radius.md },
  photoModalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
  photoModalImg: { width: "94%", height: "78%", borderRadius: Radius.lg },
  photoDel: {
    position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
  },
  leaveBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  leaveCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  leaveCard: { width: "100%", maxWidth: 420, borderRadius: Radius.xl, padding: 22, paddingTop: 30, borderWidth: StyleSheet.hairlineWidth * 2, ...glow("#000", 24, 0.4) },
  leaveClose: { position: "absolute", top: 12, right: 14, zIndex: 1 },
  leaveOpt: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  leaveBack: { paddingVertical: 13, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center", justifyContent: "center" },
});
