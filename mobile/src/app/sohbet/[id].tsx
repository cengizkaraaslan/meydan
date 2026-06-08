import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { AuroraBackground } from "@/components/AuroraBackground";
import { getPerson } from "@/lib/people";
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

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t: T } = useTheme();
  const { t } = useT();
  const canSeeAges = useCanSeeAges();
  const person = getPerson(String(id));
  const { messages, typing, send, sendImage, editMessage, deleteMessage } = useChat(String(id));
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Msg | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  // Yalnızca yeni gönderdiğim balona giriş animasyonu uygulamak için son gönderim zamanını tutuyoruz.
  const [lastSentAt, setLastSentAt] = useState(0);
  const listRef = useRef<FlatList<Msg>>(null);

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
    const isImage = !!m.imageUri;
    const buttons: { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }[] = [];
    if (!isImage) {
      buttons.push({
        text: "Düzenle",
        onPress: () => {
          setEditing(m);
          setText(m.text);
        },
      });
    }
    buttons.push({
      text: "Sil",
      style: "destructive",
      onPress: () => {
        Alert.alert("Mesajı sil", "Bu mesaj silinsin mi?", [
          { text: "İptal", style: "cancel" },
          {
            text: "Sil",
            style: "destructive",
            onPress: () => {
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
            },
          },
        ]);
      },
    });
    buttons.push({ text: "İptal", style: "cancel" });
    Alert.alert(isImage ? "Fotoğraf" : "Mesaj", undefined, buttons);
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
        <Pressable onPress={() => { tapH(); router.push(`/kisi/${person.id}`); }} style={styles.hAvatarWrap} hitSlop={6}>
          <Image source={{ uri: person.avatar }} style={styles.hAvatar} contentFit="cover" />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => { tapH(); router.push(`/kisi/${person.id}`); }}>
          <Text style={[Type.title, { color: T.text }]}>{canSeeAges ? `${person.name}, ${person.age}` : person.name}</Text>
          <Text style={[Type.label, { color: typing ? T.primary : person.online ? T.success : T.textFaint }]}>
            {typing ? `${t("typing")}` : person.online ? t("online") : `${person.distanceKm} km ${t("away")}`}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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

        {/* Girdi */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom ? insets.bottom : 12, borderTopColor: T.hairline }]}>
          <Pressable onPress={onPickImage} hitSlop={8} style={[styles.attach, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={{ fontSize: 20 }}>📷</Text>
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("message_hint", { name: person.name })}
            placeholderTextColor={T.textFaint}
            style={[Type.body, styles.input, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
            multiline
            onSubmitEditing={onSend}
          />
          <Pressable onPress={onSend}>
            <Animated.View style={sendBtnStyle}>
              <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                <Text style={{ fontSize: 18, color: "#fff" }}>↑</Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* İlk mesaj ipucu (ömür boyu 1 kez) */}
      <Modal visible={tipVisible} transparent animationType="fade" onRequestClose={() => setTipVisible(false)}>
        <View style={styles.tipBackdrop}>
          <View style={[styles.tipCard, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={[Type.body, { color: T.text, textAlign: "center" }]}>
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
  if (m.fromMe) {
    return (
      // Facebook Messenger tarzı gönderim: yeni balon aşağıdan yukarı + hafif scale/opaklık ile "pop".
      <Animated.View
        entering={justSent ? FadeInDown.springify().damping(15).stiffness(180).mass(0.6) : undefined}
        style={{ alignSelf: "flex-end", maxWidth: "82%" }}
      >
        <Pressable onLongPress={onLongPress} delayLongPress={300}>
          <LinearGradient colors={T.primarySoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.mine, isImage && styles.imgBubble]}>
            {isImage ? (
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
      {isImage ? (
        <Image source={{ uri: m.imageUri }} style={styles.img} contentFit="cover" transition={150} />
      ) : (
        <Text style={[Type.body, { color: T.text }]}>{m.text}</Text>
      )}
      <Text style={[styles.meta, { color: T.textFaint, alignSelf: "flex-end" }]}>{hhmm(m.at)}</Text>
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
  editBar: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  tipBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  tipCard: { width: "100%", borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: 22 },
  tipBtn: { borderRadius: Radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
});
