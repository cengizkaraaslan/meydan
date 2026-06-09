import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, type Href } from "expo-router";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { showAuthPrompt } from "@/lib/authPrompt";
import { impactH } from "@/lib/haptics";
import { listConversations, totalUnread, type Conversation } from "@/lib/conversations";

const SIZE = 58;
const MARGIN = 16;

/**
 * Anasayfada sürüklenebilir, en yakın kenara yapışan yüzen sohbet balonu.
 * Dokununca Instagram-Direct tarzı tam ekran mesaj kutusu (/mesajlar) açılır.
 * Rozet için okunmamış toplamı odaklandıkça tazelenir.
 */
export function ChatBubble() {
  const { t: T } = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const unread = totalUnread(convos);

  const refresh = useCallback(() => {
    listConversations().then(setConvos).catch(() => {});
  }, []);

  // Anasayfa her odaklandığında (sohbetten dönünce) okunmamış sayılarını tazele.
  useFocusEffect(refresh);

  const minX = MARGIN;
  const maxX = width - SIZE - MARGIN;
  const minY = insets.top + 70;
  const maxY = height - SIZE - 130; // tab bar üstünde kal

  const x = useSharedValue(maxX);
  const y = useSharedValue(maxY - 40);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const openMessages = useCallback(() => {
    impactH();
    // Sohbet yalnız gerçek kullanıcıya açık → girişsizse şık premium giriş modalı.
    if (!user) {
      showAuthPrompt(t("lock_chat_title"));
      return;
    }
    // "/mesajlar" yeni route — typed-routes union'ı expo start/build'de yeniden üretilince tanınır.
    router.push("/mesajlar" as Href);
  }, [user, t]);

  const clamp = (v: number, lo: number, hi: number) => {
    "worklet";
    return Math.min(Math.max(v, lo), hi);
  };

  // Saf dokunuş Pan'i aktive etmediği için ayrı bir Tap gesture'ı şart.
  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd(() => {
      runOnJS(openMessages)();
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

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.wrap, style, glow(T.primary, 20, 0.5)]}>
        <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <Text style={styles.emoji}>💬</Text>
        </LinearGradient>
        {unread > 0 && (
          <View style={[styles.bubbleBadge, { borderColor: T.bg }]}>
            <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
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
  bubbleBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
