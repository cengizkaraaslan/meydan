import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Radius, Type, glow } from "../theme/aurora";
import { useTheme } from "../lib/theme";
import { useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { impactH } from "../lib/haptics";

/** E-posta ile giriş sheet'i (Google OAuth gerektirmeden anında çalışır). */
export function EmailSignInSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t: T } = useTheme();
  const { t } = useT();
  const { signInWithEmail } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = /\S+@\S+\.\S+/.test(email);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    impactH();
    await signInWithEmail(name, email);
    setBusy(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline }, glow(T.primary, 22, 0.4)]}>
          <Text style={[Type.h2, { color: T.text, textAlign: "center" }]}>{t("email_continue")}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("email_name")}
            placeholderTextColor={T.textFaint}
            style={[Type.body, styles.input, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("email_addr")}
            placeholderTextColor={T.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[Type.body, styles.input, { color: T.text, backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
            onSubmitEditing={submit}
          />
          <Pressable onPress={submit} disabled={!valid || busy} style={[{ borderRadius: Radius.pill, overflow: "hidden", marginTop: 6 }, (!valid || busy) && { opacity: 0.5 }]}>
            <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
              <Text style={[Type.title, { color: "#fff" }]}>{t("email_go")}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, paddingBottom: 36, gap: 12 },
  input: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 13 },
  btn: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
});
