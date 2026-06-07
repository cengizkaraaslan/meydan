import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Radius, Type, glow } from "../theme/aurora";
import { useTheme } from "../lib/theme";
import { useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { impactH, tapH } from "../lib/haptics";
import { EmailSignInSheet } from "./EmailSignInSheet";
import { useState } from "react";
import { useAuthPromptState, hideAuthPrompt } from "../lib/authPrompt";

/**
 * Cezbedici premium giriş modalı (Alert yerine). Google girişine teşvik eder.
 * title: bağlama göre başlık (eşleşme/sohbet/favori).
 */
export function SignInPrompt({
  visible,
  title,
  onClose,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
}) {
  const { t: T } = useTheme();
  const { t } = useT();
  const { signInWithGoogle, configured, signingIn } = useAuth();
  const [emailOpen, setEmailOpen] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInDown.duration(320)} style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline }, glow(T.primary, 26, 0.5)]}>
          <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, glow(T.primary, 18, 0.6)]}>
            <Text style={{ fontSize: 32 }}>💜</Text>
          </LinearGradient>
          <Text style={[Type.h2, { color: T.text, textAlign: "center", marginTop: 16 }]}>{title}</Text>
          <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: 8 }]}>{t("lock_body")}</Text>

          <Pressable
            onPress={() => { impactH(); signInWithGoogle(); }}
            disabled={!configured || signingIn}
            style={[styles.google, (!configured || signingIn) && { opacity: 0.55 }]}
          >
            {signingIn ? <ActivityIndicator color="#1F1F1F" /> : (
              <>
                <Text style={styles.g}>G</Text>
                <Text style={[Type.title, { color: "#1F1F1F" }]}>{t("continue_google")}</Text>
              </>
            )}
          </Pressable>
          {!configured && (
            <Text style={[Type.label, { color: T.textFaint, textAlign: "center", marginTop: 8 }]}>{t("google_pending")}</Text>
          )}

          <Pressable onPress={() => { tapH(); setEmailOpen(true); }} style={[styles.email, { borderColor: T.hairline }]}>
            <Text style={[Type.title, { color: T.text }]}>✉️  {t("email_continue")}</Text>
          </Pressable>

          <Pressable onPress={() => { tapH(); onClose(); }} style={{ paddingVertical: 12, marginTop: 2 }}>
            <Text style={[Type.label, { color: T.textFaint, textAlign: "center" }]}>{t("maybe_later")}</Text>
          </Pressable>
        </Animated.View>
        <EmailSignInSheet visible={emailOpen} onClose={() => { setEmailOpen(false); onClose(); }} />
      </Animated.View>
    </Modal>
  );
}

/** Kökte TEK kez mount edilir; showAuthPrompt() ile tetiklenir (per-kart Modal yok). */
export function GlobalSignInPrompt() {
  const s = useAuthPromptState();
  return <SignInPrompt visible={s.visible} title={s.title} onClose={hideAuthPrompt} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, paddingBottom: 36, alignItems: "center",
  },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  google: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: Radius.pill, paddingVertical: 15, width: "100%", marginTop: 22,
  },
  g: { fontSize: 19, fontWeight: "800", color: "#4285F4" },
  email: { width: "100%", marginTop: 12, paddingVertical: 14, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center" },
});
