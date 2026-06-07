import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Type, glow } from "@/theme/aurora";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH, impactH } from "@/lib/haptics";
import { GenderOnboarding } from "@/components/GenderOnboarding";
import { EmailSignInSheet } from "@/components/EmailSignInSheet";
import { useState } from "react";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { user, guest, signInWithGoogle, continueAsGuest, configured, signingIn } = useAuth();
  const { t: T, gender } = useTheme();
  const { t } = useT();
  const [emailOpen, setEmailOpen] = useState(false);

  // Giriş yapıldı ama cinsiyet seçilmediyse: cinsiyet adımını BU ekranın içinde göster
  // (route içeriği — sibling overlay native ekranın altında kalıyor).
  if ((user || guest) && gender === null) {
    return <GenderOnboarding />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <View style={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 }]}>
        {/* Marka */}
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center", marginTop: 30 }}>
          <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.logo, glow("#7C3AED", 26, 0.6)]}>
            <Text style={{ fontSize: 42, color: "#fff" }}>✦</Text>
          </LinearGradient>
          <Text style={[Type.hero, { color: T.text, marginTop: 22 }]}>
            Meydan<Text style={{ color: T.primary }}>Fest</Text>
          </Text>
          <Text style={[Type.body, { color: T.textDim, marginTop: 6, textAlign: "center" }]}>
            {t("tagline")}
          </Text>
          <Animated.Text
            entering={FadeInDown.duration(500).delay(360)}
            style={[Type.label, { color: T.gold, marginTop: 14, textAlign: "center", paddingHorizontal: 12 }]}
          >
            {t("signin_creators")}
          </Animated.Text>
        </Animated.View>

        {/* Aksiyonlar */}
        <View style={{ gap: 14 }}>
          <Animated.View entering={FadeInDown.duration(500).delay(120)}>
            <Pressable
              onPress={() => { impactH(); signInWithGoogle(); }}
              disabled={!configured || signingIn}
              style={[styles.googleBtn, (!configured || signingIn) && { opacity: 0.55 }]}
            >
              {signingIn ? (
                <ActivityIndicator color="#1F1F1F" />
              ) : (
                <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={[Type.title, { color: "#1F1F1F" }]}>{t("continue_google")}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {!configured && (
            <Animated.Text entering={FadeInDown.duration(500).delay(180)} style={[Type.label, { color: T.textFaint, textAlign: "center" }]}>
              {t("google_pending")}
            </Animated.Text>
          )}

          <Animated.View entering={FadeInDown.duration(500).delay(210)}>
            <Pressable onPress={() => { tapH(); setEmailOpen(true); }} style={[styles.guestBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={[Type.title, { color: T.text }]}>✉️  {t("email_continue")}</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(240)}>
            <Pressable onPress={() => { tapH(); continueAsGuest(); }} style={[styles.guestBtn, { backgroundColor: "transparent", borderColor: "transparent" }]}>
              <Text style={[Type.label, { color: T.textFaint }]}>{t("explore_guest")}</Text>
            </Pressable>
          </Animated.View>

          <Animated.Text entering={FadeInDown.duration(500).delay(300)} style={[Type.label, { color: T.textFaint, textAlign: "center", marginTop: 4 }]}>
            {t("terms")}
          </Animated.Text>
        </View>
      </View>
      <EmailSignInSheet visible={emailOpen} onClose={() => setEmailOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  logo: { width: 92, height: 92, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: Radius.pill, paddingVertical: 16,
  },
  googleG: { fontSize: 20, fontWeight: "800", color: "#4285F4" },
  guestBtn: {
    alignItems: "center", justifyContent: "center", paddingVertical: 15, borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
