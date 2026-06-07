import React, { useEffect, useState } from "react";
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
import { CITIES, CATEGORIES } from "@/lib/categories";
import { useFavorites } from "@/lib/favorites";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { router } from "expo-router";
import { useTheme, themeForGender, PALETTES, type Palette, type Gender, type ThemeName } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useActiveCity } from "@/lib/location";
import { syncProfile } from "@/lib/profileSync";
import { tapH, impactH } from "@/lib/haptics";
import { getNotifPrefs, setNotifPrefs, type NotifPrefs } from "@/lib/notify";

function Stat({ value, label, color, T }: { value: string; label: string; color: string; T: Palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[Type.h1, { color }]}>{value}</Text>
      <Text style={[Type.label, { color: T.textFaint, marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

function ThemeCard({
  name,
  label,
  active,
  T,
  onPress,
}: {
  name: ThemeName;
  label: string;
  active: boolean;
  T: Palette;
  onPress: () => void;
}) {
  const pal = PALETTES[name];
  return (
    <Pressable
      onPress={() => {
        tapH();
        onPress();
      }}
      style={[
        styles.themeCard,
        {
          backgroundColor: T.surfaceStrong,
          borderColor: active ? pal.primary : T.hairline,
          borderWidth: active ? 2 : StyleSheet.hairlineWidth * 2,
        },
        active && glow(pal.primary, 14, 0.45),
      ]}
    >
      <LinearGradient
        colors={pal.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.themeDot, glow(pal.primary, 8, 0.5)]}
      >
        {active ? <Text style={styles.themeCheck}>✓</Text> : null}
      </LinearGradient>
      <Text style={[Type.label, { color: active ? T.text : T.textDim }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { list } = useFavorites();
  const { user, signOut, signInWithGoogle, configured } = useAuth();
  const { t: T, name, setTheme, gender, setGender } = useTheme();
  const { t, lang, setLang } = useT();
  const { city, detected, setCity } = useActiveCity();

  // Görünüm (tema/dil/cinsiyet) — açılır/kapanır, varsayılan kapalı
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  // #25 Bildirim tercihleri
  const [notifOpen, setNotifOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>({ mode: "all", cities: [], categories: [] });
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    let alive = true;
    getNotifPrefs().then((p) => {
      if (alive) setPrefs(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const persistPrefs = (next: NotifPrefs) => {
    setPrefs(next);
    setNotifPrefs(next);
    setSavedAt(Date.now());
    impactH();
  };

  const setNotifMode = (mode: NotifPrefs["mode"]) => {
    persistPrefs({ ...prefs, mode });
  };

  const toggleNotifCity = (c: string) => {
    const has = prefs.cities.includes(c);
    persistPrefs({ ...prefs, cities: has ? prefs.cities.filter((x) => x !== c) : [...prefs.cities, c] });
  };

  const toggleNotifCat = (key: string) => {
    const has = prefs.categories.includes(key);
    persistPrefs({ ...prefs, categories: has ? prefs.categories.filter((x) => x !== key) : [...prefs.categories, key] });
  };

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

        {/* Görünüm: tema + dil + cinsiyet — açılır/kapanır, varsayılan kapalı */}
        <Animated.View entering={FadeInDown.duration(450).delay(180)}>
          <Pressable onPress={() => { tapH(); setAppearanceOpen((o) => !o); }}>
            <SectionHeader
              title={t("appearance")}
              accent={T.primary}
              action={<Text style={[Type.h2, { color: T.primary }]}>{appearanceOpen ? "▾" : "▸"}</Text>}
            />
          </Pressable>
          {appearanceOpen && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <GlassCard padded style={{ marginBottom: Space.xl }}>
                {/* Tema — renk önizlemeli kartlar */}
                <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("theme")}</Text>
                <View style={styles.themeRow}>
                  <ThemeCard name="aurora" label={t("theme_aurora")} active={name === "aurora"} T={T} onPress={() => setTheme("aurora")} />
                  <ThemeCard name="blue" label={t("theme_blue")} active={name === "blue"} T={T} onPress={() => setTheme("blue")} />
                  <ThemeCard name="pink" label={t("theme_pink")} active={name === "pink"} T={T} onPress={() => setTheme("pink")} />
                </View>

                <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

                {/* Dil — bayraklı */}
                <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("language")}</Text>
                <View style={styles.pillWrap}>
                  <Pill label="🇹🇷 Türkçe" active={lang === "tr"} onPress={() => setLang("tr")} />
                  <Pill label="🇬🇧 English" active={lang === "en"} onPress={() => setLang("en")} />
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
          )}
        </Animated.View>

        {/* (#25) Bildirim tercihleri — açılır/kapanır */}
        <Animated.View entering={FadeInDown.duration(450).delay(210)}>
          <Pressable onPress={() => { tapH(); setNotifOpen((o) => !o); }}>
            <SectionHeader
              title={t("notif_prefs")}
              accent={T.cyan}
              action={<Text style={[Type.h2, { color: T.cyan }]}>{notifOpen ? "▾" : "▸"}</Text>}
            />
          </Pressable>
          {notifOpen && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <GlassCard padded style={{ marginBottom: Space.xl }}>
                <Text style={[Type.body, { color: T.textDim, marginBottom: Space.md }]}>
                  {t("notif_help")}
                </Text>

                {/* Mod */}
                <View style={styles.pillWrap}>
                  <Pill label={t("notif_all")} active={prefs.mode === "all"} onPress={() => setNotifMode("all")} />
                  <Pill label={t("notif_custom")} active={prefs.mode === "custom"} gradient={T.primarySoft} onPress={() => setNotifMode("custom")} />
                  <Pill label={t("notif_off")} active={prefs.mode === "off"} onPress={() => setNotifMode("off")} />
                </View>

                {prefs.mode === "custom" && (
                  <Animated.View entering={FadeInDown.duration(260)}>
                    <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

                    {/* Şehirler */}
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("notif_pick_cities")}</Text>
                    <View style={styles.pillWrap}>
                      {CITIES.map((c) => (
                        <Pill
                          key={c}
                          label={c}
                          active={prefs.cities.includes(c)}
                          gradient={T.primarySoft}
                          onPress={() => toggleNotifCity(c)}
                        />
                      ))}
                    </View>

                    <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

                    {/* Kategoriler */}
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("notif_pick_cats")}</Text>
                    <View style={styles.pillWrap}>
                      {CATEGORIES.map((c) => (
                        <Pill
                          key={c.key}
                          label={`${c.emoji} ${c.label}`}
                          active={prefs.categories.includes(c.key)}
                          gradient={c.gradient}
                          onPress={() => toggleNotifCat(c.key)}
                        />
                      ))}
                    </View>
                  </Animated.View>
                )}

                {savedAt > 0 && (
                  <Animated.Text
                    key={savedAt}
                    entering={FadeInDown.duration(240)}
                    style={[Type.label, { color: T.cyan, marginTop: Space.md, textAlign: "center" }]}
                  >
                    {t("notif_saved")}
                  </Animated.Text>
                )}
              </GlassCard>
            </Animated.View>
          )}
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
  themeRow: { flexDirection: "row", gap: Space.sm },
  themeCard: {
    flex: 1,
    alignItems: "center",
    gap: Space.sm,
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.md,
  },
  themeDot: { width: 34, height: 34, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  themeCheck: { color: "#fff", fontSize: 16, fontWeight: "800" },
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
