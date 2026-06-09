import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";

/**
 * Premium tema-uyumlu bilgi/hata modalı (OS Alert yerine). Ortada kart,
 * blur arka plan, gradient buton. tone: "error" | "success" | "info".
 */
export function InfoModal({
  visible,
  title,
  message,
  tone = "info",
  buttonLabel = "Tamam",
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  tone?: "error" | "success" | "info";
  buttonLabel?: string;
  onClose: () => void;
}) {
  const { t: T } = useTheme();
  const icon = tone === "error" ? "⚠️" : tone === "success" ? "✓" : "💜";
  const iconBg =
    tone === "error" ? "rgba(255,59,48,0.16)" : tone === "success" ? "rgba(52,199,89,0.16)" : T.surfaceStrong;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={FadeInDown.duration(280)}
          style={[styles.card, { backgroundColor: T.bgElevated, borderColor: T.hairline }, glow(T.primary, 22, 0.4)]}
        >
          <View style={[styles.icon, { backgroundColor: iconBg }]}>
            <Text style={{ fontSize: 30 }}>{icon}</Text>
          </View>
          <Text style={[Type.h2, { color: T.text, textAlign: "center", marginTop: 14 }]}>{title}</Text>
          {message ? (
            <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: 8, lineHeight: 21 }]}>
              {message}
            </Text>
          ) : null}
          <Pressable onPress={onClose} style={{ width: "100%", marginTop: 22 }}>
            <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
              <Text style={[Type.title, { color: "#fff" }]}>{buttonLabel}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: "rgba(0,0,0,0.35)" },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: 24,
    paddingBottom: 22,
    alignItems: "center",
  },
  icon: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  btn: { borderRadius: Radius.pill, alignItems: "center", justifyContent: "center", paddingVertical: 14 },
});
