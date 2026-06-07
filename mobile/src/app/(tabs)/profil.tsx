import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton, Pill, SectionHeader } from "@/ui/atoms";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { CITIES } from "@/lib/categories";
import { useFavorites } from "@/lib/favorites";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { router } from "expo-router";
import { useTheme, themeForGender, type Palette, type Gender } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useActiveCity } from "@/lib/location";
import { syncProfile } from "@/lib/profileSync";
import { tapH, impactH } from "@/lib/haptics";

function Stat({ value, label, color, T }: { value: string; label: string; color: string; T: Palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[Type.h1, { color }]}>{value}</Text>
      <Text style={[Type.label, { color: T.textFaint, marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { list } = useFavorites();
  const { user, signOut, signInWithGoogle, configured } = useAuth();
  const { t: T, name, setTheme, gender, setGender } = useTheme();
  const { t, lang, setLang } = useT();
  const { city, detected, setCity } = useActiveCity();

  const pickCity = (c: string) => {
    const next = city === c ? null : c;
    setCity(next);
    syncProfile({ city: next });
  };

  const pickGender = (g: Gender) => {
    setGender(g);
    setTheme(themeForGender(g));
    syncProfile({ gender: g });
  };

  const openSite = () => WebBrowser.openBrowserAsync(API_BASE);

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 130,
          paddingHorizontal: 16,
        }}
      >
        {/* Kullanıcı bloğu */}
        <Animated.View entering={FadeInDown.duration(450)} style={styles.brand}>
          {user?.photo ? (
            <Image source={{ uri: user.photo }} style={[styles.avatar, glow(T.primary, 24, 0.6)]} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={T.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatar, glow(T.primary, 24, 0.6)]}
            >
              <Text style={styles.avatarMark}>{user ? user.name.charAt(0).toUpperCase() : "✦"}</Text>
            </LinearGradient>
          )}
          <Text style={[Type.h1, { color: T.text, marginTop: Space.md }]}>
            {user ? user.name : t("guest")}
          </Text>
          <Text style={[Type.label, { color: T.textFaint, marginTop: 4 }]}>
            {user?.email || t("exploring")}
          </Text>

          {user ? (
            <Pressable onPress={() => { impactH(); signOut(); }} style={[styles.signOut, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={[Type.label, { color: T.pink }]}>{t("sign_out")}</Text>
            </Pressable>
          ) : null}
        </Animated.View>

        {/* (#1) Oturumsuzken belirgin Google girişi — oturum açınca gizlenir */}
        {!user && (
          <Animated.View entering={FadeInDown.duration(450).delay(40)} style={{ marginBottom: Space.xl }}>
            <Pressable
              onPress={() => { impactH(); signInWithGoogle(); }}
              disabled={!configured}
              style={[styles.googleBtn, !configured && { opacity: 0.5 }]}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={[Type.title, { color: "#1F1F1F" }]}>{t("signin_google")}</Text>
            </Pressable>
            {!configured && (
              <Text style={[Type.label, { color: T.textFaint, textAlign: "center", marginTop: Space.sm }]}>
                {t("google_pending")}
              </Text>
            )}
          </Animated.View>
        )}

        {/* (#6) Yönetim — sadece kurucu admin görür */}
        {isAdmin(user) && (
          <Animated.View entering={FadeInDown.duration(450).delay(90)}>
            <Pressable onPress={() => { tapH(); router.push("/admin"); }} style={{ marginBottom: Space.xl }}>
              <GlassCard glowColor={T.gold} padded>
                <View style={styles.adminRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Space.md, flex: 1 }}>
                    <LinearGradient
                      colors={T.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.adminIcon, glow(T.primary, 14, 0.5)]}
                    >
                      <Text style={{ fontSize: 18 }}>🛡️</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={[Type.title, { color: T.text }]}>{t("admin_panel")}</Text>
                      <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>{t("admin_users")}</Text>
                    </View>
                  </View>
                  <Text style={[Type.h2, { color: T.gold }]}>→</Text>
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        )}

        {/* İstatistik */}
        <Animated.View entering={FadeInDown.duration(450).delay(60)}>
          <GlassCard glowColor={T.indigo} style={{ marginBottom: Space.xl }}>
            <View style={styles.statsRow}>
              <Stat T={T} value={String(list.length)} label={t("tab_favorites")} color={T.pink} />
              <View style={[styles.vline, { backgroundColor: T.hairline }]} />
              <Stat T={T} value="2100+" label={t("stat_event")} color={T.cyan} />
              <View style={[styles.vline, { backgroundColor: T.hairline }]} />
              <Stat T={T} value="81" label={t("stat_city")} color={T.gold} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Şehir */}
        <Animated.View entering={FadeInDown.duration(450).delay(120)}>
          <SectionHeader title={`${t("detected_city")}  📍 ${city ?? "—"}`} accent={T.blue} />
          <View style={[styles.pillWrap, { marginBottom: Space.xl }]}>
            {CITIES.map((c) => (
              <Pill
                key={c}
                label={c}
                active={city === c}
                gradient={T.primarySoft}
                onPress={() => pickCity(c)}
              />
            ))}
          </View>
        </Animated.View>

        {/* Görünüm: tema + dil + cinsiyet */}
        <Animated.View entering={FadeInDown.duration(450).delay(180)}>
          <SectionHeader title={t("appearance")} accent={T.primary} />
          <GlassCard padded style={{ marginBottom: Space.xl }}>
            {/* Tema */}
            <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("theme")}</Text>
            <View style={styles.pillWrap}>
              <Pill label={t("theme_aurora")} active={name === "aurora"} onPress={() => setTheme("aurora")} />
              <Pill label={t("theme_blue")} active={name === "blue"} onPress={() => setTheme("blue")} />
              <Pill label={t("theme_pink")} active={name === "pink"} onPress={() => setTheme("pink")} />
            </View>

            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

            {/* Dil */}
            <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("language")}</Text>
            <View style={styles.pillWrap}>
              <Pill label="Türkçe" active={lang === "tr"} onPress={() => setLang("tr")} />
              <Pill label="English" active={lang === "en"} onPress={() => setLang("en")} />
            </View>

            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

            {/* Cinsiyet */}
            <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("gender")}</Text>
            <View style={styles.pillWrap}>
              <Pill label={t("male")} active={gender === "male"} onPress={() => pickGender("male")} />
              <Pill label={t("female")} active={gender === "female"} onPress={() => pickGender("female")} />
              <Pill label={t("other")} active={gender === "other"} onPress={() => pickGender("other")} />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Keşfet / Bağlantılar */}
        <Animated.View entering={FadeInDown.duration(450).delay(240)}>
          <SectionHeader title={t("discover_links")} accent={T.pink} />
          <GlassCard padded style={{ marginBottom: Space.xl }}>
            <View style={{ gap: Space.md }}>
              <GradientButton
                label={t("open_site")}
                icon="🌐"
                gradient={T.primarySoft}
                onPress={openSite}
              />
              <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
              <GradientButton
                label={t("suggest_event")}
                icon="✨"
                gradient={T.primarySoft}
                onPress={openSite}
              />
              <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
              <GradientButton
                label={t("feedback")}
                icon="💬"
                gradient={T.primarySoft}
                onPress={openSite}
              />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Hakkında */}
        <Animated.View entering={FadeInDown.duration(450).delay(300)}>
          <SectionHeader title={t("about")} accent={T.gold} />
          <GlassCard padded>
            <Text style={[Type.body, { color: T.textDim }]}>
              {t("about_text")}
            </Text>
            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />
            <Text style={[Type.label, { color: T.textFaint }]}>{t("version")}</Text>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brand: { alignItems: "center", marginBottom: Space.xl, marginTop: Space.sm },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMark: { fontSize: 34, color: "#fff", fontWeight: "800" },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  stat: { flex: 1, alignItems: "center" },
  vline: { width: StyleSheet.hairlineWidth * 2, height: 38 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  hairline: { height: StyleSheet.hairlineWidth * 2 },
  signOut: { marginTop: Space.md, paddingHorizontal: 18, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  googleBtn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: Radius.pill,
    backgroundColor: "#fff",
    ...glow("#fff", 18, 0.18),
  },
  googleG: { fontSize: 17, fontWeight: "800", color: "#4285F4" },
  adminRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adminIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
});
