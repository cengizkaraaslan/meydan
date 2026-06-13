import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import Animated, { Easing, FadeInDown, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { AuroraBackground } from "@/components/AuroraBackground";
import { getPerson, type Person } from "@/lib/people";
import { resolveAvatar } from "@/lib/avatar";
import { useChat, canEditMsg, replySnippet, type Msg, type MsgReactions } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useCanSeeAges } from "@/lib/dprofile";
import { SignInPrompt } from "@/components/SignInPrompt";
import { tapH, tapHaptic } from "@/lib/haptics";
import { sndSend } from "@/lib/sound";
import { deleteConversation } from "@/lib/conversations";
import { apiBlockUser, apiReportUser } from "@/lib/api";
import { getProfileKey } from "@/lib/profileSync";
import { ReactionPicker } from "@/components/ReactionPicker";

const READ_BLUE = "#34B7F1";
const CHAT_TIP_KEY = "meydanfest:chatTipSeen";


function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ms → "m:ss" (sesli mesaj süresi/sayaç). */
function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Son görülme: az önce / X dk önce / bugün HH:MM / DD.MM HH:MM. */
// Şikayet nedenleri (üç nokta menüsü → Şikayet et).
const REPORT_REASONS = [
  "Spam / reklam",
  "Taciz / hakaret",
  "Sahte profil",
  "Uygunsuz içerik",
  "Dolandırıcılık",
  "Diğer",
];

function lastSeenText(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "az önce";
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} dk önce`;
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return today ? hhmm(ms) : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${hhmm(ms)}`;
}

/** Sunucuda kayıtlı (tepki verilebilir) mesaj mı? Yerel optimistik/offline id'ler hariç. */
function isServerMsgId(id: string): boolean {
  return !id.startsWith("tmp_") && !id.startsWith("img_") && !id.startsWith("voice_");
}

export default function ChatScreen() {
  const { id, name: pName, avatar: pAvatar, matchKey: pMatchKey } = useLocalSearchParams<{ id: string; name?: string; avatar?: string; matchKey?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t: T } = useTheme();
  const { t } = useT();
  const canSeeAges = useCanSeeAges();
  // PEOPLE'da olan mock kişi; yoksa (gerçek kullanıcı) parametreden ad/avatar ile kur.
  const realPerson = getPerson(String(id));
  const person: Person | null =
    realPerson ??
    (pName || pAvatar
      ? {
          id: String(id),
          name: pName || "Kullanıcı",
          age: 0,
          city: "",
          distanceKm: 0,
          online: false,
          avatar: resolveAvatar(pAvatar, pName, "male"),
          bio: "",
          interests: [],
          gender: "male",
        }
      : null);
  const { messages, reactions, react, loadOlder, hasMoreOlder, loadingOlder, typing, partnerPresence, notifyTyping, send, sendImage, sendVoice, sendBuzz, editMessage, deleteMessage, matchKey, ready } = useChat(String(id), {
    name: pName,
    avatar: pAvatar,
    matchKey: pMatchKey,
  });
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Msg | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  // Fotoğrafa dokununca tam ekran gösterilecek görsel (null = kapalı).
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // Sağa kaydırınca yanıtlanacak (alıntılanacak) mesaj (null = yanıt yok).
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  // Mesaja uzun basınca açılan tepki popover'ı için seçili mesaj (null = kapalı) + dikey konum.
  const [actionMsg, setActionMsg] = useState<Msg | null>(null);
  const [anchorY, setAnchorY] = useState(0);
  const { height: winH } = useWindowDimensions();
  // Action-sheet içinde "Sil" onayı görünür mü?
  const [confirmDel, setConfirmDel] = useState(false);
  // Yalnızca yeni gönderdiğim balona giriş animasyonu uygulamak için son gönderim zamanını tutuyoruz.
  const [lastSentAt, setLastSentAt] = useState(0);
  const listRef = useRef<FlatList<Msg>>(null);

  // ── Sesli mesaj kaydı (expo-audio) ──
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);
  const recStartRef = useRef(0);

  // Sesli mesaj OYNATMA için ses oturumunu hazırla: sessiz modda da çalsın ve kayıt
  // modunda DEĞİL (kayıttan sonra oturum "recording"de kalırsa oynatma sessiz olur).
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Mikrofon izni", "Sesli mesaj için mikrofon iznine ihtiyaç var.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Kayıt için ses oturumunu kayıt moduna al (iOS şart; Android'de de yönlendirmeyi düzeltir).
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStartRef.current = Date.now();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, [recorder]);

  const stopRecordingAndSend = useCallback(async () => {
    try {
      await recorder.stop();
      // Kayıttan sonra oynatma moduna geri dön → gönderilen/gelen sesler duyulabilsin.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      const sec = (Date.now() - recStartRef.current) / 1000;
      setRecording(false);
      if (uri && sec >= 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sndSend();
        void sendVoice(uri, sec);
      }
    } catch {
      setRecording(false);
    }
  }, [recorder, sendVoice]);

  const cancelRecording = useCallback(async () => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      /* yoksay */
    }
    setRecording(false);
    tapH();
  }, [recorder]);

  // Gönder (↑) butonunun "pulse/uçuş" efekti (sadece sohbet ekranında).
  const sendScale = useSharedValue(1);
  const sendBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));
  const pulseSendBtn = useCallback(() => {
    sendScale.value = withSequence(
      withTiming(0.82, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.12, { duration: 130, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 110, easing: Easing.inOut(Easing.ease) }),
    );
  }, [sendScale]);

  // ── Titreşim ("dürt"): ekranı sars + güçlü haptik. Gelen yeni buzz'da bir kez tetiklenir
  // (push yok; karşı taraf uygulamayı/ sohbeti açınca görür). Son görülen buzz matchKey'e
  // göre AsyncStorage'da → eski buzz her açılışta tekrar sarsmaz, yalnız YENİ buzz sarsar.
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const triggerShake = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    shakeX.value = withSequence(
      withTiming(-11, { duration: 45 }), withTiming(11, { duration: 45 }),
      withTiming(-9, { duration: 45 }), withTiming(9, { duration: 45 }),
      withTiming(-5, { duration: 40 }), withTiming(5, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  }, [shakeX]);

  const buzzSeenRef = useRef<number>(-1); // -1: henüz yüklenmedi
  useEffect(() => {
    const key = matchKey || pMatchKey;
    if (!key) return;
    AsyncStorage.getItem(`meydanfest:lastBuzz:${key}`).then((v) => {
      buzzSeenRef.current = v ? Number(v) || 0 : 0;
    }).catch(() => { buzzSeenRef.current = 0; });
  }, [matchKey, pMatchKey]);

  useEffect(() => {
    if (buzzSeenRef.current < 0) return; // son-görülen henüz yüklenmedi
    const incoming = messages.filter((m) => m.buzz && !m.fromMe);
    const newest = incoming.length ? incoming[incoming.length - 1].at : 0;
    if (newest > buzzSeenRef.current) {
      buzzSeenRef.current = newest;
      const key = matchKey || pMatchKey;
      if (key) AsyncStorage.setItem(`meydanfest:lastBuzz:${key}`, String(newest)).catch(() => {});
      triggerShake();
    }
  }, [messages, triggerShake, matchKey, pMatchKey]);

  const onBuzz = useCallback(() => {
    triggerShake();      // kendi ekranında da his ver
    void sendBuzz();
  }, [triggerShake, sendBuzz]);


  // Dibe yalnız YENİ (alttaki) mesaj gelince kaydır; eski mesaj (yukarıda) yüklenince ZIPLAMA.
  const lastAtRef = useRef(0);
  useEffect(() => {
    const newest = messages.length ? messages[messages.length - 1].at : 0;
    const grewAtBottom = newest > lastAtRef.current;
    lastAtRef.current = Math.max(lastAtRef.current, newest);
    if (grewAtBottom || typing) {
      const tm = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(tm);
    }
  }, [messages, typing]);

  // Sohbete girince ilk içerik oturana kadar EN ALTA kaydır (maintainVisibleContentPosition aksi
  // halde görünümü üstte sabitleyebiliyor). İlk yükleme bitince bırak (loadOlder zıplamasın).
  const initialScrolled = useRef(false);
  useEffect(() => {
    if (messages.length > 0 && !initialScrolled.current) {
      const tm = setTimeout(() => { initialScrolled.current = true; }, 600);
      return () => clearTimeout(tm);
    }
  }, [messages.length]);
  const onContentSize = useCallback(() => {
    if (!initialScrolled.current && messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: false });
    }
  }, [messages.length]);

  // Sohbete girince dibe in: maintainVisibleContentPosition başta görünümü üstte
  // sabitleyebildiği ve içerik (görsel/ses balonları) geç oturduğu için TEK scrollToEnd
  // yetmiyordu → hazır olup ilk mesajlar gelince kademeli birkaç kez dibe kaydır.
  const didInitScroll = useRef(false);
  useEffect(() => {
    if (didInitScroll.current || !ready || messages.length === 0) return;
    didInitScroll.current = true;
    const timers = [60, 250, 500, 900].map((d) =>
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), d),
    );
    return () => timers.forEach(clearTimeout);
  }, [ready, messages.length]);

  if (!person) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={[Type.h2, { color: T.text }]}>{t("person_not_found")}</Text>
        <Pressable onPress={() => { tapH(); router.back(); }}><Text style={{ color: T.primary, marginTop: 8 }}>← {t("back")}</Text></Pressable>
      </View>
    );
  }

  // Sohbet yalnızca gerçek kullanıcıya açık.
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AuroraBackground />
        <View style={styles.lock}>
          <Image source={{ uri: person.avatar }} style={styles.lockAvatar} contentFit="cover" transition={250} />
          <Text style={[Type.h2, { color: T.text, marginTop: 16, textAlign: "center" }]}>{t("lock_chat_title")}</Text>
          <Text style={[Type.body, { color: T.textFaint, marginTop: 8, textAlign: "center" }]}>{t("lock_body")}</Text>
        </View>
        <SignInPrompt visible title={t("lock_chat_title")} onClose={() => router.back()} />
      </View>
    );
  }

  // İlk mesajdan sonra (ömür boyu 1 kez) ipucu modalını göster.
  const maybeShowTip = useCallback(async () => {
    try {
      const seen = await AsyncStorage.getItem(CHAT_TIP_KEY);
      if (seen === "1") return;
      await AsyncStorage.setItem(CHAT_TIP_KEY, "1");
      setTipVisible(true);
    } catch {
      /* yoksay */
    }
  }, []);

  const onSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sndSend();
    pulseSendBtn();
    // Bu gönderimle eklenecek balona giriş animasyonu uygula (sadece yeni gönderilen).
    setLastSentAt(Date.now());
    if (editing) {
      const target = editing;
      setEditing(null);
      setText("");
      void (async () => {
        const r = await editMessage(target.id, trimmed);
        if (!r.ok) {
          Alert.alert(
            "Düzenlenemedi",
            r.reason === "expired"
              ? "Bu mesajın düzenleme süresi (10 dk) doldu."
              : "Mesaj düzenlenemedi, tekrar dene.",
          );
        }
      })();
      return;
    }
    // Yanıt varsa alıntı bilgisini gönder (qMine = alıntılanan mesaj benimki mi).
    const rep = replyTo
      ? { id: replyTo.id, qMine: !!replyTo.fromMe, snippet: replySnippet(replyTo) }
      : null;
    void send(trimmed, rep);
    setReplyTo(null);
    setText("");
    void maybeShowTip();
  };

  // Sağa kaydır / sheet'ten "Yanıtla" → bu mesajı alıntıla.
  const beginReply = useCallback((m: Msg) => {
    if (m.pending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyTo(m);
  }, []);

  const onLongPressMsg = (m: Msg, e?: GestureResponderEvent) => {
    if (m.pending) return; // gönderilmekte olan mesaja işlem yok
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Dokunulan noktanın altına popover'ı konumla (ekranın en altına değil).
    if (e) setAnchorY(e.nativeEvent.pageY);
    setConfirmDel(false);
    setActionMsg(m);
  };

  // Tepki ver/değiştir/kaldır (aynı emojiye tekrar basınca kaldırır). Çift taraflı görünür.
  const onReactFromSheet = (emoji: string) => {
    const m = actionMsg;
    if (!m) return;
    closeActionSheet();
    const mine = reactions[m.id]?.mine ?? null;
    void react(m.id, mine === emoji ? "" : emoji);
  };

  const closeActionSheet = () => {
    setActionMsg(null);
    setConfirmDel(false);
  };

  const onEditFromSheet = () => {
    const m = actionMsg;
    if (!m) return;
    tapH();
    closeActionSheet();
    setEditing(m);
    setText(m.text);
  };

  const onDeleteFromSheet = () => {
    const m = actionMsg;
    if (!m) return;
    tapH();
    closeActionSheet();
    void (async () => {
      const r = await deleteMessage(m.id);
      if (!r.ok) {
        Alert.alert(
          "Silinemedi",
          r.reason === "expired"
            ? "Bu mesajın silme süresi (10 dk) doldu."
            : "Mesaj silinemedi, tekrar dene.",
        );
      }
    })();
  };

  const cancelEdit = () => {
    setEditing(null);
    setText("");
  };

  // ── Üç nokta menüsü: Şikayet et / Engelle ──
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<"menu" | "report">("menu");
  const openMenu = () => { tapHaptic(); setMenuMode("menu"); setMenuOpen(true); };

  const submitReport = (reason: string) => {
    setMenuOpen(false);
    (async () => {
      const me = await getProfileKey();
      const ok = await apiReportUser(me, String(id), reason, matchKey || pMatchKey);
      Alert.alert(
        ok ? "Şikayet alındı" : "Hata",
        ok ? "Şikayetin yöneticiye iletildi. İncelenecek — teşekkürler." : "Şikayet gönderilemedi, tekrar dene.",
      );
    })();
  };

  const onBlock = () => {
    setMenuOpen(false);
    Alert.alert(
      "Engelle",
      `${person.name} engellensin mi? Artık sana mesaj gönderemez ve sohbet listenden kalkar.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Engelle",
          style: "destructive",
          onPress: () => {
            (async () => {
              const me = await getProfileKey();
              const key = matchKey || pMatchKey;
              router.replace("/mesajlar" as Href);
              await apiBlockUser(me, String(id));
              if (key) void deleteConversation(key);
            })();
          },
        },
      ],
      { cancelable: true },
    );
  };

  // Header'daki çöp kutusu: tüm sohbeti sil → listeden kalksın → listeleme sayfasına dön.
  const onDeleteConversation = () => {
    tapH();
    Alert.alert(
      "Sohbeti sil",
      `${person.name} ile olan sohbet tamamen silinsin mi? Bu işlem geri alınamaz.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            const key = matchKey || pMatchKey;
            // Önce listeleme sayfasına dön (liste odakta backend'den tazelenip silineni göstermez),
            // sonra arkada backend silmesini tetikle.
            router.replace("/mesajlar" as Href);
            if (key) void deleteConversation(key);
          },
        },
      ],
      { cancelable: true },
    );
  };

  const onPickImage = async () => {
    tapH();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sndSend();
    void sendImage(res.assets[0].uri);
  };

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.hairline }]}>
        <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10} style={[styles.back, { backgroundColor: T.surfaceStrong }]}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Pressable onPress={() => { tapH(); router.push({ pathname: "/kisi/[id]", params: { id: person.id, name: person.name, avatar: person.avatar } }); }} style={styles.hAvatarWrap} hitSlop={6}>
          <Image source={{ uri: person.avatar }} style={styles.hAvatar} contentFit="cover" />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => { tapH(); router.push({ pathname: "/kisi/[id]", params: { id: person.id, name: person.name, avatar: person.avatar } }); }}>
          <Text style={[Type.title, { color: T.text }]}>{canSeeAges && person.age ? `${person.name}, ${person.age}` : person.name}</Text>
          <Text style={[Type.label, { color: typing || partnerPresence.online ? (partnerPresence.online && !typing ? T.success : T.primary) : T.textFaint }]}>
            {typing
              ? `${t("typing")}`
              : partnerPresence.online
                ? t("online")
                : partnerPresence.lastSeen
                  ? `son görülme ${lastSeenText(partnerPresence.lastSeen)}`
                  : person.distanceKm
                    ? `${person.distanceKm} km ${t("away")}`
                    : ""}
          </Text>
        </Pressable>
        {/* Sohbeti komple sil → listeye dön. Sohbet hazır (matchKey bilinene) kadar pasif. */}
        <Pressable onPress={onDeleteConversation} disabled={!ready} hitSlop={10} style={[styles.back, { backgroundColor: T.surfaceStrong, opacity: ready ? 1 : 0.4 }]}>
          <Ionicons name="trash-outline" size={19} color="#FF3B30" />
        </Pressable>
        {/* Üç nokta: Şikayet et / Engelle */}
        <Pressable onPress={openMenu} hitSlop={10} style={[styles.back, { backgroundColor: T.surfaceStrong }]}>
          <Ionicons name="ellipsis-vertical" size={19} color={T.text} />
        </Pressable>
      </View>

      {/* Üç nokta menüsü (alt sayfa): Şikayet et / Engelle + şikayet nedeni seçimi */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.menuSheet, { backgroundColor: T.bg, borderColor: T.hairline, paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
            <View style={[styles.menuHandle, { backgroundColor: T.hairline }]} />
            {menuMode === "menu" ? (
              <>
                <Pressable style={styles.menuRow} onPress={() => { tapHaptic(); setMenuMode("report"); }}>
                  <Ionicons name="flag-outline" size={20} color={T.text} />
                  <Text style={[Type.title, { color: T.text }]}>Şikayet et</Text>
                </Pressable>
                <View style={[styles.menuSep, { backgroundColor: T.hairline }]} />
                <Pressable style={styles.menuRow} onPress={onBlock}>
                  <Ionicons name="ban-outline" size={20} color="#FF3B30" />
                  <Text style={[Type.title, { color: "#FF3B30" }]}>Engelle</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[Type.label, { color: T.textDim, paddingHorizontal: 16, paddingBottom: 6 }]}>Şikayet nedeni</Text>
                {REPORT_REASONS.map((r) => (
                  <Pressable key={r} style={styles.menuRow} onPress={() => submitReport(r)}>
                    <Ionicons name="alert-circle-outline" size={18} color={T.textDim} />
                    <Text style={[Type.title, { color: T.text }]}>{r}</Text>
                  </Pressable>
                ))}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Sohbet hazır olana kadar (ensureMatch + ilk fetch) şık bir loading; header zaten yukarıda anında çiziliyor. */}
        {ready ? (
          <Animated.View style={[{ flex: 1 }, shakeStyle]}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            // Yukarı kaydırınca eski mesajları yükle; eklenince görünür konum sabit kalsın (zıplamasın).
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y <= 48 && hasMoreOlder && !loadingOlder) void loadOlder();
            }}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSize}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            ListHeaderComponent={
              loadingOlder ? (
                <View style={{ paddingVertical: 10, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={T.primary} />
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <SwipeToReply T={T} onReply={() => beginReply(item)}>
                <Bubble
                  T={T}
                  m={item}
                  read={item.fromMe && !item.pending && item.readAt != null}
                  reaction={reactions[item.id]}
                  partnerName={person.name}
                  // Yalnızca en sondaki KENDİ balonum, üstelik az önce gönderilmişse "pop" girişi yapar.
                  justSent={item.fromMe && index === messages.length - 1 && item.at >= lastSentAt && lastSentAt > 0}
                  onLongPress={(e) => onLongPressMsg(item, e)}
                  onImagePress={setViewerUri}
                />
              </SwipeToReply>
            )}
            ListFooterComponent={
              typing ? (
                <TypingBubble T={T} />
              ) : (() => {
                // WhatsApp/Instagram tarzı "Görüldü {saat}" — son mesajım okunduysa, en altta.
                const last = messages[messages.length - 1];
                return last && last.fromMe && !last.pending && last.readAt ? (
                  <Text style={{ alignSelf: "flex-end", color: T.textFaint, fontSize: 11, marginTop: 3, marginRight: 4 }}>
                    Görüldü {hhmm(last.readAt)}
                  </Text>
                ) : null;
              })()
            }
          />
          </Animated.View>
        ) : (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={T.primary} />
            <Text style={[Type.label, { color: T.textFaint, marginTop: 12 }]}>Sohbet yükleniyor…</Text>
          </View>
        )}

        {/* Düzenleme modu göstergesi */}
        {editing ? (
          <View style={[styles.editBar, { backgroundColor: T.surfaceStrong, borderTopColor: T.hairline }]}>
            <Text style={[Type.label, { color: T.primary, flex: 1 }]} numberOfLines={1}>
              Mesajı düzenliyorsun
            </Text>
            <Pressable onPress={() => { tapH(); cancelEdit(); }} hitSlop={10}>
              <Text style={{ color: T.textFaint, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Yanıt (alıntı) önizleme çubuğu — gönderince mesajın üstünde alıntı görünür */}
        {replyTo && !editing ? (
          <View style={[styles.replyBar, { backgroundColor: T.surfaceStrong, borderTopColor: T.hairline }]}>
            <View style={[styles.replyAccent, { backgroundColor: T.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={[Type.label, { color: T.primary, fontWeight: "700" }]} numberOfLines={1}>
                {replyTo.fromMe ? "Sen" : person.name}
              </Text>
              <Text style={[Type.label, { color: T.textDim }]} numberOfLines={1}>
                {replySnippet(replyTo)}
              </Text>
            </View>
            <Pressable onPress={() => { tapH(); setReplyTo(null); }} hitSlop={10}>
              <Ionicons name="close" size={18} color={T.textFaint} />
            </Pressable>
          </View>
        ) : null}

        {/* Girdi / Sesli mesaj kayıt çubuğu */}
        {recording ? (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom ? insets.bottom : 12, borderTopColor: T.hairline }]}>
            <Pressable onPress={cancelRecording} hitSlop={8} style={[styles.attach, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </Pressable>
            <View style={[styles.recBar, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <View style={styles.recDot} />
              <Text style={[Type.body, { color: T.text }]}>{mmss(recState.durationMillis ?? 0)}</Text>
              <Text style={[Type.label, { color: T.textFaint, marginLeft: 10 }]}>Kaydediliyor…</Text>
            </View>
            <Pressable onPress={stopRecordingAndSend}>
              <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                <Ionicons name="send" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom ? insets.bottom : 12, borderTopColor: T.hairline, opacity: ready ? 1 : 0.55 }]}>
            <Pressable onPress={onPickImage} disabled={!ready} hitSlop={8} style={[styles.attach, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={{ fontSize: 20 }}>📷</Text>
            </Pressable>
            {/* Titreştir ("dürt") — karşı tarafın ekranını titretir (push yok) */}
            <Pressable onPress={onBuzz} disabled={!ready} hitSlop={8} style={[styles.attach, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={{ fontSize: 20 }}>🫨</Text>
            </Pressable>
            <TextInput
              value={text}
              onChangeText={(v) => { setText(v); notifyTyping(); }}
              editable={ready}
              placeholder={t("message_hint", { name: person.name })}
              placeholderTextColor={T.textFaint}
              style={[Type.body, styles.input, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
              multiline
              onSubmitEditing={onSend}
            />
            {text.trim().length === 0 && !editing ? (
              <Pressable onPress={startRecording} disabled={!ready} hitSlop={6}>
                <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                  <Ionicons name="mic" size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={onSend} disabled={!ready}>
                <Animated.View style={sendBtnStyle}>
                  <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                    <Ionicons name="send" size={20} color="#fff" />
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Mesaj uzun-bas action-sheet (tema uyumlu, alttan açılır) */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={closeActionSheet}>
        {/* Dokunulan mesajın hemen altında beliren tepki popover'ı (ekranın en altında DEĞİL). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeActionSheet}>
          <View
            pointerEvents="box-none"
            style={[
              styles.popover,
              { top: Math.max(insets.top + 52, Math.min(anchorY + 8, winH - 230)) },
              actionMsg?.fromMe ? { right: 12, alignItems: "flex-end" } : { left: 12, alignItems: "flex-start" },
            ]}
          >
            {confirmDel ? (
              <Pressable onPress={() => {}} style={[styles.popConfirm, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}>
                <Text style={[Type.body, { color: T.text, textAlign: "center", marginBottom: 12 }]}>
                  Bu mesaj silinsin mi?
                </Text>
                <View style={styles.sheetConfirmRow}>
                  <Pressable onPress={() => { tapH(); setConfirmDel(false); }} style={[styles.sheetRow, styles.sheetRowHalf, { backgroundColor: T.surfaceStrong }]}>
                    <Text style={[Type.body, { color: T.text, fontWeight: "600" }]}>Vazgeç</Text>
                  </Pressable>
                  <Pressable onPress={onDeleteFromSheet} style={[styles.sheetRow, styles.sheetRowHalf, { backgroundColor: "rgba(255,59,48,0.14)" }]}>
                    <Text style={[Type.body, { color: "#FF3B30", fontWeight: "700" }]}>Sil</Text>
                  </Pressable>
                </View>
              </Pressable>
            ) : (
              <>
                {/* Emojiler — kendi pill'ini çizer (ek kart yok). */}
                {actionMsg && isServerMsgId(actionMsg.id) ? (
                  <ReactionPicker myReaction={reactions[actionMsg.id]?.mine ?? null} onPick={onReactFromSheet} />
                ) : null}
                {/* Düzenle/Sil yalnız KENDİ mesajın & 10 dk içinde — emojilerin altında küçük butonlar. */}
                {actionMsg && canEditMsg(actionMsg) ? (
                  <View style={styles.popActions}>
                    {!actionMsg.imageUri && !actionMsg.audioUri ? (
                      <Pressable onPress={onEditFromSheet} style={[styles.popBtn, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}>
                        <Text style={[Type.label, { color: T.text }]}>✏️ Düzenle</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => { tapH(); setConfirmDel(true); }} style={[styles.popBtn, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}>
                      <Text style={[Type.label, { color: "#FF3B30" }]}>🗑️ Sil</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* İlk mesaj ipucu (ömür boyu 1 kez) */}
      <Modal visible={tipVisible} transparent animationType="fade" onRequestClose={() => setTipVisible(false)}>
        <View style={styles.tipBackdrop}>
          <View style={[styles.tipCard, { backgroundColor: T.bgElevated, borderColor: T.hairline }]}>
            <Text style={[Type.body, { color: T.text, textAlign: "center", lineHeight: 22 }]}>
              💬 İpucu: Gönderdiğin mesajı 10 dakika içinde düzenleyebilir veya silebilirsin — mesaja basılı tut.
            </Text>
            <Pressable onPress={() => { tapH(); setTipVisible(false); }} style={{ marginTop: 18 }}>
              <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tipBtn}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Anladım</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Tam ekran fotoğraf görüntüleyici — herhangi bir yere dokun → kapat */}
      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} style={styles.viewerImg} contentFit="contain" transition={150} />
          ) : null}
          <Pressable onPress={() => { tapH(); setViewerUri(null); }} hitSlop={12} style={[styles.viewerClose, { top: insets.top + 12 }]}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Ticks({ read, pending }: { read: boolean; pending?: boolean }) {
  if (pending) return <Text style={[styles.meta, { color: "rgba(255,255,255,0.65)" }]}>🕓</Text>;
  return (
    <Text style={[styles.ticks, { color: read ? READ_BLUE : "rgba(255,255,255,0.7)" }]}>✓✓</Text>
  );
}

/** Bir mesaja konan tepkileri küçük bir çip olarak gösterir (balonun alt kenarında). */
function ReactionChip({ T, reaction, mine }: { T: Palette; reaction?: MsgReactions; mine: boolean }) {
  const emojis = [...new Set([reaction?.mine, reaction?.theirs].filter(Boolean) as string[])];
  if (!emojis.length) return null;
  return (
    <View style={[styles.reactChip, { backgroundColor: T.bgElevated, borderColor: T.hairline, alignSelf: mine ? "flex-end" : "flex-start" }]}>
      <Text style={{ fontSize: 13 }}>{emojis.join(" ")}</Text>
    </View>
  );
}

// Satır-içi saat için son satırda rezerve edilen boşluk (WhatsApp tekniği): kısa metinde
// saat yanına sığar, uzun/çok satırlıda boşluk alta kayar → saat sağ-altta durur.
const MINE_SPACER = "          "; // saat + tik + araya bosluk
const THEIRS_SPACER = "        "; // saat + araya bosluk

/** Sağa kaydırınca mesajı yanıtla (WhatsApp tarzı). Eşik geçilince bırakınca tetiklenir. */
function SwipeToReply({ T, onReply, children }: { T: Palette; onReply: () => void; children: React.ReactNode }) {
  const tx = useSharedValue(0);
  const fired = useSharedValue(false);
  const pan = Gesture.Pan()
    .activeOffsetX(14) // yalnız yatay (sağa) sürüklemede aktifleşir
    .failOffsetY([-12, 12]) // dikey hareket → liste kayar, yanıt iptal
    .onUpdate((e) => {
      const x = Math.max(0, Math.min(e.translationX, 72));
      tx.value = x;
      if (x > 52 && !fired.value) { fired.value = true; runOnJS(tapHaptic)(); }
      if (x <= 52) fired.value = false;
    })
    .onEnd((e) => {
      if (e.translationX > 52) runOnJS(onReply)();
      tx.value = withTiming(0, { duration: 160 });
      fired.value = false;
    });
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: Math.min(tx.value / 52, 1) }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View>
        <Animated.View style={[styles.replyIcon, iconStyle]}>
          <Ionicons name="arrow-undo" size={18} color={T.primary} />
        </Animated.View>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Balon üstünde alıntı bloğu (yanıtlanan mesajın yazarı + özeti). */
function QuoteBlock({ T, replyTo, mineMsg, partnerName, onPrimary }: { T: Palette; replyTo: NonNullable<Msg["replyTo"]>; mineMsg: boolean; partnerName: string; onPrimary?: boolean }) {
  // Alıntılanan mesaj görüntüleyene göre benimki mi? (qMine yanıtı gönderene göre; gelen yanıtta çevir.)
  const quotedIsMine = mineMsg ? replyTo.qMine : !replyTo.qMine;
  const author = quotedIsMine ? "Sen" : partnerName;
  const bg = onPrimary ? "rgba(255,255,255,0.16)" : T.bgElevated;
  const barColor = onPrimary ? "rgba(255,255,255,0.9)" : T.primary;
  const authorColor = onPrimary ? "#fff" : T.primary;
  const snipColor = onPrimary ? "rgba(255,255,255,0.85)" : T.textDim;
  return (
    <View style={[styles.quoteBlock, { backgroundColor: bg }]}>
      <View style={[styles.quoteBar, { backgroundColor: barColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.quoteAuthor, { color: authorColor }]} numberOfLines={1}>{author}</Text>
        <Text style={[styles.quoteSnippet, { color: snipColor }]} numberOfLines={2}>{replyTo.snippet}</Text>
      </View>
    </View>
  );
}

/** Metin + sağ-altta satır-içi saat (kısa→yanında, uzun→altında). */
function InlineMetaText({ color, text, spacer, meta }: { color: string; text: string; spacer: string; meta: React.ReactNode }) {
  return (
    <View style={{ position: "relative" }}>
      <Text style={[Type.body, { color }]}>
        {text}
        <Text>{spacer}</Text>
      </Text>
      <View style={styles.inlineMeta}>{meta}</View>
    </View>
  );
}

function Bubble({ T, m, read, reaction, partnerName, justSent, onLongPress, onImagePress }: { T: Palette; m: Msg; read: boolean; reaction?: MsgReactions; partnerName: string; justSent?: boolean; onLongPress?: (e: GestureResponderEvent) => void; onImagePress?: (uri: string) => void }) {
  const isImage = !!m.imageUri;
  const isAudio = !!m.audioUri;
  const isText = !isImage && !isAudio;
  // Titreşim ("dürt") mesajı → ortada küçük sistem satırı (sağ/sol balon değil).
  if (m.buzz) {
    return (
      <View style={{ alignSelf: "center", paddingVertical: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.surfaceStrong, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 }}>
          <Text style={{ fontSize: 14 }}>🫨</Text>
          <Text style={[Type.label, { color: T.textDim }]}>
            {m.fromMe ? "Titreşim gönderdin" : `${partnerName} titreşim gönderdi`}
          </Text>
        </View>
      </View>
    );
  }
  if (m.fromMe) {
    return (
      // Facebook Messenger tarzı gönderim: yeni balon aşağıdan yukarı + hafif scale/opaklık ile "pop".
      <Animated.View
        entering={justSent ? FadeInDown.springify().damping(15).stiffness(180).mass(0.6) : undefined}
        style={{ alignSelf: "flex-end", maxWidth: "82%" }}
      >
        <Pressable onLongPress={onLongPress} delayLongPress={300}>
          <LinearGradient colors={T.primarySoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.mine, isImage && styles.imgBubble]}>
            {m.replyTo ? <QuoteBlock T={T} replyTo={m.replyTo} mineMsg partnerName={partnerName} onPrimary /> : null}
            {isAudio ? (
              <VoiceMessage uri={m.audioUri!} sec={m.audioSec} tint="#fff" track="rgba(255,255,255,0.35)" />
            ) : isImage ? (
              <Pressable onPress={() => onImagePress?.(m.imageUri!)} onLongPress={onLongPress} delayLongPress={300}>
                <Image source={{ uri: m.imageUri }} style={styles.img} contentFit="cover" transition={150} />
              </Pressable>
            ) : (
              <InlineMetaText
                color="#fff"
                text={m.text}
                spacer={MINE_SPACER}
                meta={<><Text style={[styles.meta, { color: "rgba(255,255,255,0.7)" }]}>{hhmm(m.at)}</Text><Ticks read={read} pending={m.pending} /></>}
              />
            )}
            {!isText ? (
              <View style={styles.metaRow}>
                <Text style={[styles.meta, { color: "rgba(255,255,255,0.7)" }]}>{hhmm(m.at)}</Text>
                <Ticks read={read} pending={m.pending} />
              </View>
            ) : null}
          </LinearGradient>
        </Pressable>
        <ReactionChip T={T} reaction={reaction} mine />
      </Animated.View>
    );
  }
  return (
    <View>
      {/* Gelen mesaja da basılı tut → tepki ver (eskiden Pressable yoktu, bu yüzden çalışmıyordu). */}
      <Pressable onLongPress={onLongPress} delayLongPress={300}>
        <View style={[styles.bubble, styles.theirs, isImage && styles.imgBubble, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
          {m.replyTo ? <QuoteBlock T={T} replyTo={m.replyTo} mineMsg={false} partnerName={partnerName} /> : null}
          {isAudio ? (
            <VoiceMessage uri={m.audioUri!} sec={m.audioSec} tint={T.text} track={T.hairline} />
          ) : isImage ? (
            <Pressable onPress={() => onImagePress?.(m.imageUri!)} onLongPress={onLongPress} delayLongPress={300}>
              <Image source={{ uri: m.imageUri }} style={styles.img} contentFit="cover" transition={150} />
            </Pressable>
          ) : (
            <InlineMetaText
              color={T.text}
              text={m.text}
              spacer={THEIRS_SPACER}
              meta={<Text style={[styles.meta, { color: T.textFaint }]}>{hhmm(m.at)}</Text>}
            />
          )}
          {!isText ? (
            <Text style={[styles.meta, { color: T.textFaint, alignSelf: "flex-end" }]}>{hhmm(m.at)}</Text>
          ) : null}
        </View>
      </Pressable>
      <ReactionChip T={T} reaction={reaction} mine={false} />
    </View>
  );
}

/** Sesli mesaj oynatıcı balonu — MESAJ BAŞINA kendi oynatıcısı (kanıtlanmış: ses çalıyor).
 *  Paylaşımlı/replace tabanlı oynatıcı expo-audio 56'da hiç çalmıyordu; bu desen çalışır. */
/** Basit deterministik dosya adı (uri → cache anahtarı). */
function voiceCacheName(uri: string): string {
  let h = 0;
  for (let i = 0; i < uri.length; i++) h = (h * 31 + uri.charCodeAt(i)) | 0;
  return `voice-${(h >>> 0).toString(36)}.m4a`;
}

function VoiceMessage({ uri, sec, tint, track }: { uri: string; sec?: number; tint: string; track: string }) {
  // Uzak (http) sesi ÖNCE yerele indir, sonra yerelden çal. ExoPlayer/AVPlayer uzak
  // URL'den stream ederken proxy'nin Range/stream davranışına takılıp sessiz kalabiliyor;
  // yerel m4a ise sorunsuz çalar. İndirme olmazsa uzak uri ile çalmayı dene (fallback).
  const isRemote = uri.startsWith("http");
  const [localUri, setLocalUri] = useState<string | null>(isRemote ? null : uri);
  useEffect(() => {
    if (!isRemote) { setLocalUri(uri); return; }
    let alive = true;
    (async () => {
      try {
        const target = (FileSystem.cacheDirectory ?? "") + voiceCacheName(uri);
        const info = await FileSystem.getInfoAsync(target);
        if (info.exists && info.size && info.size > 0) { if (alive) setLocalUri(target); return; }
        const dl = await FileSystem.downloadAsync(uri, target);
        if (alive) setLocalUri(dl.uri);
      } catch {
        if (alive) setLocalUri(uri); // indirme başarısız → uzak uri ile dene
      }
    })();
    return () => { alive = false; };
  }, [uri, isRemote]);

  const player = useAudioPlayer(localUri ?? uri);
  const status = useAudioPlayerStatus(player);
  const dur = status.duration && status.duration > 0 ? status.duration : sec ?? 0;
  const cur = status.currentTime ?? 0;
  const playing = status.playing;
  const progress = dur > 0 ? Math.min(cur / dur, 1) : 0;
  const shown = playing || cur > 0.05 ? cur : dur;
  const toggle = async () => {
    tapHaptic(); // sessiz — play tuşunda tıklama sesi olmasın
    if (playing) {
      player.pause();
      return;
    }
    // Çalmadan ÖNCE ses oturumunu OYNATMA moduna zorla: kayıttan sonra Android oturumu
    // "recording" yönlendirmesinde kalıp sesi kısabiliyor (gönderdiğim sesi oynatınca ses
    // gelmiyor sorunu). playsInSilentMode → iOS sessiz anahtarında da duyulur.
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    } catch {
      /* yoksay — yine de çalmayı dene */
    }
    // Bittiyse (veya sona gelmişse) başa sar, sonra çal; aksi halde kaldığı yerden devam.
    if (status.didJustFinish || (dur > 0 && cur >= dur - 0.15)) player.seekTo(0);
    player.play();
  };
  return (
    <View style={styles.voiceRow}>
      <Pressable onPress={toggle} hitSlop={8}>
        <Ionicons name={playing ? "pause" : "play"} size={22} color={tint} />
      </Pressable>
      <View style={[styles.voiceTrack, { backgroundColor: track }]}>
        <View style={[styles.voiceFill, { backgroundColor: tint, width: `${progress * 100}%` }]} />
      </View>
      <Text style={[styles.voiceTime, { color: tint }]}>{mmss(shown * 1000)}</Text>
    </View>
  );
}

function Dot({ T, delay }: { T: Palette; delay: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [o, delay]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.typingDot, { backgroundColor: T.textDim }, st]} />;
}

function TypingBubble({ T }: { T: Palette }) {
  return (
    <View style={[styles.bubble, styles.theirs, { backgroundColor: T.surfaceStrong, borderColor: T.hairline, flexDirection: "row", gap: 5, paddingVertical: 14 }]}>
      <Dot T={T} delay={0} />
      <Dot T={T} delay={150} />
      <Dot T={T} delay={300} />
    </View>
  );
}

const styles = StyleSheet.create({
  reactChip: {
    marginTop: -6,
    marginHorizontal: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(8,7,13,0.5)",
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  hAvatarWrap: { borderRadius: 21 },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  menuSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  menuHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, paddingHorizontal: 18 },
  menuSep: { height: StyleSheet.hairlineWidth, marginLeft: 18 },
  hAvatar: { width: 42, height: 42, borderRadius: 21 },
  lock: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockAvatar: { width: 96, height: 96, borderRadius: 48 },
  // WhatsApp tarzı: az yuvarlak (8) köşeler, bir köşe sivri (kuyruk), kompakt padding.
  bubble: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8 },
  imgBubble: { padding: 3 },
  mine: { borderTopRightRadius: 3, ...glow("#6366F1", 10, 0.35) },
  theirs: { alignSelf: "flex-start", maxWidth: "82%", borderTopLeftRadius: 3, borderWidth: StyleSheet.hairlineWidth * 2 },
  img: { width: 210, height: 210, borderRadius: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 3 },
  meta: { fontSize: 10.5, marginTop: 2 },
  ticks: { fontSize: 11, fontWeight: "700", letterSpacing: -2 },
  typingDot: { width: 7, height: 7, borderRadius: 4 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(8,7,13,0.6)",
  },
  attach: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  input: {
    flex: 1, maxHeight: 110, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  recBar: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 44,
    paddingHorizontal: 14, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FF3B30" },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 168, paddingVertical: 2 },
  voiceTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden", minWidth: 92 },
  voiceFill: { height: 4, borderRadius: 2 },
  voiceTime: { fontSize: 11, minWidth: 32, textAlign: "right" },
  editBar: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  tipBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  tipCard: { width: "100%", borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 22 },
  tipBtn: { borderRadius: Radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  sheetScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheetCard: {
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16, paddingTop: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetRow: { borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  sheetCancel: { marginTop: 10, backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth * 2 },
  sheetConfirmRow: { flexDirection: "row", gap: 10 },
  sheetRowHalf: { flex: 1 },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewerImg: { width: "100%", height: "100%" },
  viewerClose: { position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  // Satır-içi saat: balonun sağ-alt köşesinde, metin son satırının rezerve boşluğu üstünde.
  inlineMeta: { position: "absolute", right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  // Balon içi alıntı bloğu (yanıtlanan mesaj).
  quoteBlock: { flexDirection: "row", borderRadius: 6, overflow: "hidden", marginBottom: 4, paddingVertical: 3, paddingRight: 8 },
  quoteBar: { width: 3, borderRadius: 2, marginRight: 7 },
  quoteAuthor: { fontSize: 12.5, fontWeight: "700", marginBottom: 1 },
  quoteSnippet: { fontSize: 12.5 },
  // Sağa kaydırınca beliren yanıt ikonu (balonun arkasında, solda).
  replyIcon: { position: "absolute", left: 14, top: 0, bottom: 0, justifyContent: "center" },
  // Input üstündeki yanıt önizleme çubuğu.
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  replyAccent: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  // Uzun-bas tepki popover'ı (dokunulan mesajın altına konumlanır).
  popover: { position: "absolute" },
  popActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  popBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2 },
  popConfirm: { padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, minWidth: 230 },
});
