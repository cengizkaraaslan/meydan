import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { AuroraBackground } from "@/components/AuroraBackground";
import { getPerson, type Person } from "@/lib/people";
import { resolveAvatar } from "@/lib/avatar";
import { useChat, canEditMsg, type Msg } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useCanSeeAges } from "@/lib/dprofile";
import { SignInPrompt } from "@/components/SignInPrompt";
import { tapH } from "@/lib/haptics";
import { sndSend } from "@/lib/sound";

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

export default function ChatScreen() {
  const { id, name: pName, avatar: pAvatar } = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
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
  const { messages, typing, send, sendImage, sendVoice, editMessage, deleteMessage, ready } = useChat(String(id), {
    name: pName,
    avatar: pAvatar,
  });
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Msg | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  // Mesaja uzun basınca açılan action-sheet için seçili mesaj (null = kapalı).
  const [actionMsg, setActionMsg] = useState<Msg | null>(null);
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

  const startRecording = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Mikrofon izni", "Sesli mesaj için mikrofon iznine ihtiyaç var.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  // Karşı taraftan gelen en son mesajın zamanı → benim ondan ÖNCEKİ mesajlarım "okundu" (mavi tik).
  const lastIncomingAt = useMemo(
    () => messages.reduce((mx, m) => (!m.fromMe && m.at > mx ? m.at : mx), 0),
    [messages],
  );

  useEffect(() => {
    const tm = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(tm);
  }, [messages.length, typing]);

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
    void send(trimmed);
    setText("");
    void maybeShowTip();
  };

  const onLongPressMsg = (m: Msg) => {
    if (!canEditMsg(m)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmDel(false);
    setActionMsg(m);
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
          <Text style={{ color: "#fff", fontSize: 20 }}>←</Text>
        </Pressable>
        <Pressable onPress={() => { tapH(); router.push({ pathname: "/kisi/[id]", params: { id: person.id, name: person.name, avatar: person.avatar } }); }} style={styles.hAvatarWrap} hitSlop={6}>
          <Image source={{ uri: person.avatar }} style={styles.hAvatar} contentFit="cover" />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => { tapH(); router.push({ pathname: "/kisi/[id]", params: { id: person.id, name: person.name, avatar: person.avatar } }); }}>
          <Text style={[Type.title, { color: T.text }]}>{canSeeAges && person.age ? `${person.name}, ${person.age}` : person.name}</Text>
          <Text style={[Type.label, { color: typing ? T.primary : person.online ? T.success : T.textFaint }]}>
            {typing ? `${t("typing")}` : person.online ? t("online") : person.distanceKm ? `${person.distanceKm} km ${t("away")}` : ""}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Sohbet hazır olana kadar (ensureMatch + ilk fetch) şık bir loading; header zaten yukarıda anında çiziliyor. */}
        {ready ? (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Bubble
                T={T}
                m={item}
                read={item.fromMe && !item.pending && item.at < lastIncomingAt}
                // Yalnızca en sondaki KENDİ balonum, üstelik az önce gönderilmişse "pop" girişi yapar.
                justSent={item.fromMe && index === messages.length - 1 && item.at >= lastSentAt && lastSentAt > 0}
                onLongPress={() => onLongPressMsg(item)}
              />
            )}
            ListFooterComponent={typing ? <TypingBubble T={T} /> : null}
          />
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
            <TextInput
              value={text}
              onChangeText={setText}
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
      <Modal visible={!!actionMsg} transparent animationType="slide" onRequestClose={closeActionSheet}>
        <Pressable style={styles.sheetScrim} onPress={closeActionSheet}>
          <Pressable
            style={[styles.sheetCard, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: (insets.bottom || 12) + 8 }]}
            onPress={() => { /* kart içine dokunma kapanmasın */ }}
          >
            <View style={[styles.sheetHandle, { backgroundColor: T.hairline }]} />
            <Text style={[Type.label, { color: T.textDim, textAlign: "center", marginBottom: 6 }]}>
              {actionMsg?.imageUri ? "Fotoğraf" : actionMsg?.audioUri ? "Sesli mesaj" : "Mesaj"}
            </Text>

            {confirmDel ? (
              <>
                <Text style={[Type.body, { color: T.text, textAlign: "center", marginTop: 4, marginBottom: 14 }]}>
                  Bu mesaj silinsin mi?
                </Text>
                <View style={styles.sheetConfirmRow}>
                  <Pressable
                    onPress={() => { tapH(); setConfirmDel(false); }}
                    style={[styles.sheetRow, styles.sheetRowHalf, { backgroundColor: T.surfaceStrong }]}
                  >
                    <Text style={[Type.body, { color: T.text, fontWeight: "600" }]}>Vazgeç</Text>
                  </Pressable>
                  <Pressable
                    onPress={onDeleteFromSheet}
                    style={[styles.sheetRow, styles.sheetRowHalf, { backgroundColor: "rgba(255,59,48,0.14)" }]}
                  >
                    <Text style={[Type.body, { color: "#FF3B30", fontWeight: "700" }]}>Sil</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {actionMsg && !actionMsg.imageUri && !actionMsg.audioUri ? (
                  <Pressable onPress={onEditFromSheet} style={[styles.sheetRow, { backgroundColor: T.surfaceStrong }]}>
                    <Text style={[Type.body, { color: T.text }]}>✏️  Düzenle</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => { tapH(); setConfirmDel(true); }}
                  style={[styles.sheetRow, { backgroundColor: T.surfaceStrong, marginTop: 8 }]}
                >
                  <Text style={[Type.body, { color: "#FF3B30", fontWeight: "600" }]}>🗑️  Sil</Text>
                </Pressable>
                <Pressable onPress={closeActionSheet} style={[styles.sheetRow, styles.sheetCancel, { borderColor: T.hairline }]}>
                  <Text style={[Type.body, { color: T.textDim, fontWeight: "600" }]}>İptal</Text>
                </Pressable>
              </>
            )}
          </Pressable>
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
    </View>
  );
}

function Ticks({ read, pending }: { read: boolean; pending?: boolean }) {
  if (pending) return <Text style={[styles.meta, { color: "rgba(255,255,255,0.65)" }]}>🕓</Text>;
  return (
    <Text style={[styles.ticks, { color: read ? READ_BLUE : "rgba(255,255,255,0.7)" }]}>✓✓</Text>
  );
}

function Bubble({ T, m, read, justSent, onLongPress }: { T: Palette; m: Msg; read: boolean; justSent?: boolean; onLongPress?: () => void }) {
  const isImage = !!m.imageUri;
  const isAudio = !!m.audioUri;
  if (m.fromMe) {
    return (
      // Facebook Messenger tarzı gönderim: yeni balon aşağıdan yukarı + hafif scale/opaklık ile "pop".
      <Animated.View
        entering={justSent ? FadeInDown.springify().damping(15).stiffness(180).mass(0.6) : undefined}
        style={{ alignSelf: "flex-end", maxWidth: "82%" }}
      >
        <Pressable onLongPress={onLongPress} delayLongPress={300}>
          <LinearGradient colors={T.primarySoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.mine, isImage && styles.imgBubble]}>
            {isAudio ? (
              <VoiceMessage uri={m.audioUri!} sec={m.audioSec} tint="#fff" track="rgba(255,255,255,0.35)" />
            ) : isImage ? (
              <Image source={{ uri: m.imageUri }} style={styles.img} contentFit="cover" transition={150} />
            ) : (
              <Text style={[Type.body, { color: "#fff" }]}>{m.text}</Text>
            )}
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: "rgba(255,255,255,0.7)" }]}>{hhmm(m.at)}</Text>
              <Ticks read={read} pending={m.pending} />
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }
  return (
    <View style={[styles.bubble, styles.theirs, isImage && styles.imgBubble, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
      {isAudio ? (
        <VoiceMessage uri={m.audioUri!} sec={m.audioSec} tint={T.text} track={T.hairline} />
      ) : isImage ? (
        <Image source={{ uri: m.imageUri }} style={styles.img} contentFit="cover" transition={150} />
      ) : (
        <Text style={[Type.body, { color: T.text }]}>{m.text}</Text>
      )}
      <Text style={[styles.meta, { color: T.textFaint, alignSelf: "flex-end" }]}>{hhmm(m.at)}</Text>
    </View>
  );
}

/** Sesli mesaj oynatıcı balonu — play/pause + ilerleme + süre. */
function VoiceMessage({ uri, sec, tint, track }: { uri: string; sec?: number; tint: string; track: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const dur = status.duration && status.duration > 0 ? status.duration : sec ?? 0;
  const cur = status.currentTime ?? 0;
  const progress = dur > 0 ? Math.min(cur / dur, 1) : 0;
  const playing = status.playing;
  const toggle = () => {
    tapH();
    if (playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (dur > 0 && cur >= dur - 0.05)) player.seekTo(0);
    player.play();
  };
  const shown = playing || cur > 0.05 ? cur : dur;
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
  header: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(8,7,13,0.5)",
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  hAvatarWrap: { borderRadius: 21 },
  hAvatar: { width: 42, height: 42, borderRadius: 21 },
  lock: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockAvatar: { width: 96, height: 96, borderRadius: 48 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  imgBubble: { padding: 4 },
  mine: { borderBottomRightRadius: 4, ...glow("#6366F1", 12, 0.4) },
  theirs: { alignSelf: "flex-start", maxWidth: "82%", borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth * 2 },
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
});
