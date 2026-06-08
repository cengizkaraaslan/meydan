import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { impactH, tapH } from "@/lib/haptics";
import { listConversations, type Conversation } from "@/lib/conversations";

const SIZE = 58;
const MARGIN = 16;

/**
 * Anasayfada sürüklenebilir, en yakın kenara yapışan yüzen sohbet balonu.
 * Dokununca daha önce konuşulan kişilerin (sohbet geçmişi) listesi açılır.
 */
export function ChatBubble() {
  const { t: T } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [convos, setConvos] = useState<Conversation[]>([]);

  const minX = MARGIN;
  const maxX = width - SIZE - MARGIN;
  const minY = insets.top + 70;
  const maxY = height - SIZE - 130; // tab bar üstünde kal

  const x = useSharedValue(maxX);
  const y = useSharedValue(maxY - 40);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const openPanel = useCallback(async () => {
    impactH();
    const list = await listConversations();
    setConvos(list);
    setOpen(true);
  }, []);

  const clamp = (v: number, lo: number, hi: number) => {
    "worklet";
    return Math.min(Math.max(v, lo), hi);
  };

  // Saf dokunuş Pan'i aktive etmediği için ayrı bir Tap gesture'ı şart.
  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd(() => {
      runOnJS(openPanel)();
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = clamp(startX.value + e.translationX, minX, maxX);
      y.value = clamp(startY.value + e.translationY, minY, maxY);
    })
    .onEnd(() => {
      const center = x.value + SIZE / 2;
      x.value = withSpring(center < width / 2 ? minX : maxX, { damping: 15 });
      y.value = withSpring(clamp(y.value, minY, maxY), { damping: 15 });
    });

  const gesture = Gesture.Race(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const goChat = (id: string) => {
    tapH();
    setOpen(false);
    router.push(`/sohbet/${id}`);
  };

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.wrap, style, glow(T.primary, 20, 0.5)]}>
          <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Text style={styles.emoji}>💬</Text>
          </LinearGradient>
        </Animated.View>
      </GestureDetector>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: insets.bottom + 16 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: T.hairline }]} />
            <Text style={[Type.h2, { color: T.text, marginBottom: 14 }]}>💬 {t("chats_title")}</Text>

            {convos.length === 0 ? (
              <Text style={[Type.body, { color: T.textDim, paddingVertical: 26, textAlign: "center", lineHeight: 21 }]}>
                {t("no_chats")}
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false}>
                {convos.map((c) => (
                  <Pressable
                    key={c.person.id}
                    onPress={() => goChat(c.person.id)}
                    style={({ pressed }) => [
                      styles.row,
                      { borderColor: T.hairline, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <View>
                      <Image source={{ uri: c.person.avatar }} style={styles.av} contentFit="cover" />
                      {c.person.online && <View style={[styles.dot, { backgroundColor: T.success, borderColor: T.bgElevated }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[Type.title, { color: T.text }]} numberOfLines={1}>
                        {c.person.name}
                      </Text>
                      <Text style={[Type.label, { color: T.textDim, marginTop: 2 }]} numberOfLines={1}>
                        {c.last?.fromMe ? "Sen: " : ""}{c.last?.text ?? ""}
                      </Text>
                    </View>
                    <Text style={{ color: T.textFaint, fontSize: 18 }}>›</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    zIndex: 50,
  },
  fab: {
    width: "100%",
    height: "100%",
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 26 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14, opacity: 0.6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  av: { width: 50, height: 50, borderRadius: 25 },
  dot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
});
