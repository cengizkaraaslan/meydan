import React, { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { AuroraBackground } from "@/components/AuroraBackground";
import { getPerson, useChat, type ChatMessage } from "@/lib/people";
import { useAuth } from "@/lib/auth";
import { useTheme, type Palette } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { SignInPrompt } from "@/components/SignInPrompt";
import { tapH } from "@/lib/haptics";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t: T } = useTheme();
  const { t } = useT();
  const person = getPerson(String(id));
  const { messages, typing, send } = useChat(String(id));
  const [text, setText] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

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

  // #17: Sohbet yalnızca gerçek kullanıcıya açık. Misafir dahil oturumsuz ise
  // sohbet içeriği yerine cezbedici giriş modalı; kapatınca geri dön.
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AuroraBackground />
        <View style={styles.lock}>
          <Image source={{ uri: person.avatar }} style={styles.lockAvatar} contentFit="cover" transition={250} />
          <Text style={[Type.h2, { color: T.text, marginTop: 16, textAlign: "center" }]}>
            {t("lock_chat_title")}
          </Text>
          <Text style={[Type.body, { color: T.textFaint, marginTop: 8, textAlign: "center" }]}>
            {t("lock_body")}
          </Text>
        </View>
        <SignInPrompt visible title={t("lock_chat_title")} onClose={() => router.back()} />
      </View>
    );
  }

  const onSend = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    send(text);
    setText("");
  };

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.hairline }]}>
        <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10} style={[styles.back, { backgroundColor: T.surfaceStrong }]}>
          <Text style={{ color: "#fff", fontSize: 20 }}>←</Text>
        </Pressable>
        <Image source={{ uri: person.avatar }} style={styles.hAvatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={[Type.title, { color: T.text }]}>{person.name}, {person.age}</Text>
          <Text style={[Type.label, { color: person.online ? T.success : T.textFaint }]}>
            {typing ? t("typing") : person.online ? t("online") : `${person.distanceKm} km ${t("away")}`}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <Bubble T={T} m={item} />}
          ListFooterComponent={typing ? <Bubble T={T} m={{ id: "typing", fromMe: false, text: "…", ts: 0 }} /> : null}
        />

        {/* Girdi */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom ? insets.bottom : 12, borderTopColor: T.hairline }]}>
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
            <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
              <Text style={{ fontSize: 18, color: "#fff" }}>↑</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ T, m }: { T: Palette; m: ChatMessage }) {
  if (m.fromMe) {
    return (
      <View style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
        <LinearGradient colors={T.primarySoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.mine]}>
          <Text style={[Type.body, { color: "#fff" }]}>{m.text}</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, styles.theirs, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
      <Text style={[Type.body, { color: T.text }]}>{m.text}</Text>
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
  hAvatar: { width: 42, height: 42, borderRadius: 21 },
  lock: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  lockAvatar: { width: 96, height: 96, borderRadius: 48 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { borderBottomRightRadius: 4, ...glow("#6366F1", 12, 0.4) },
  theirs: { alignSelf: "flex-start", maxWidth: "80%", borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth * 2 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth * 2, backgroundColor: "rgba(8,7,13,0.6)",
  },
  input: {
    flex: 1, maxHeight: 110, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
