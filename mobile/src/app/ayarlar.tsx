import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton, Pill, SectionHeader } from "@/ui/atoms";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { CITIES, CATEGORIES } from "@/lib/categories";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useTheme,
  themeForGender,
  PALETTES,
  THEME_NAMES,
  MODES,
  type Palette,
  type Gender,
  type ThemeName,
  type Mode,
} from "@/lib/theme";
import { useT, LANGS } from "@/lib/i18n";
import { useActiveCity } from "@/lib/location";
import { syncProfile } from "@/lib/profileSync";
import { tapH, impactH } from "@/lib/haptics";
import { getNotifPrefs, setNotifPrefs, type NotifPrefs } from "@/lib/notify";

const MODE_ICON: Record<Mode, string> = { dark: "🌙", light: "☀️", system: "⚙️" };

function ThemeCard({ name, label, active, T, onPress }: { name: ThemeName; label: string; active: boolean; T: Palette; onPress: () => void }) {
  const pal = PALETTES[name];
  return (
    <Pressable
      onPress={() => { tapH(); onPress(); }}
      style={[
        styles.themeCard,
        { backgroundColor: T.surfaceStrong, borderColor: active ? pal.primary : T.hairline, borderWidth: active ? 2 : StyleSheet.hairlineWidth * 2 },
        active && glow(pal.primary, 14, 0.45),
      ]}
    >
      <LinearGradient colors={pal.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.themeDot, glow(pal.primary, 8, 0.5)]}>
        {active ? <Text style={styles.themeCheck}>✓</Text> : null}
      </LinearGradient>
      <Text style={[Type.label, { color: active ? T.text : T.textDim }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Açılır/kapanır ayar bölümü — başlığa dokun, sadece istediğini genişlet. */
function Section({
  title,
  accent,
  openKey,
  current,
  onToggle,
  children,
  delay = 0,
}: {
  title: string;
  accent: string;
  openKey: string;
  current: string | null;
  onToggle: (k: string) => void;
  children: React.ReactNode;
  delay?: number;
}) {
  const isOpen = current === openKey;
  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delay)}>
      <Pressable onPress={() => onToggle(openKey)}>
        <SectionHeader title={title} accent={accent} action={<Text style={[Type.h2, { color: accent }]}>{isOpen ? "▾" : "▸"}</Text>} />
      </Pressable>
      {isOpen ? (
        <Animated.View entering={FadeInDown.duration(280)} style={{ marginBottom: Space.xl }}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { t: T, name, setTheme, mode, setMode, gender, setGender } = useTheme();
  const { t, lang, setLang } = useT();
  const { city, setCity } = useActiveCity();

  // Akordeon: aynı anda tek bölüm açık (varsayılan hepsi kapalı → sade görünüm).
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => { tapH(); setOpen((o) => (o === key ? null : key)); };
  const [prefs, setPrefs] = useState<NotifPrefs>({ mode: "all", cities: [], categories: [] });
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    let alive = true;
    getNotifPrefs().then((p) => { if (alive) setPrefs(p); });
    return () => { alive = false; };
  }, []);

  const persistPrefs = (next: NotifPrefs) => {
    setPrefs(next);
    setNotifPrefs(next);
    setSavedAt(Date.now());
    impactH();
  };
  const setNotifMode = (m: NotifPrefs["mode"]) => persistPrefs({ ...prefs, mode: m });
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 60, paddingHorizontal: 16 }}>
        {/* Başlık + geri */}
        <View style={styles.topBar}>
          <Pressable onPress={() => { tapH(); router.back(); }} hitSlop={10} style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>←</Text>
          </Pressable>
          <Text style={[Type.h1, { color: T.text }]}>{t("settings")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Şehir */}
        <Section title={`${t("detected_city")}  📍 ${city ?? "—"}`} accent={T.blue} openKey="city" current={open} onToggle={toggle}>
          <View style={styles.pillWrap}>
            {CITIES.map((c) => (
              <Pill key={c} label={c} active={city === c} gradient={T.primarySoft} onPress={() => pickCity(c)} />
            ))}
          </View>
        </Section>

        {/* Görünüm: mode + tema + dil + cinsiyet */}
        <Section title={t("appearance")} accent={T.primary} openKey="appearance" current={open} onToggle={toggle} delay={40}>
          <GlassCard padded>
            <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("mode")}</Text>
            <View style={styles.pillWrap}>
              {MODES.map((m) => (
                <Pill key={m} label={`${MODE_ICON[m]} ${t(`mode_${m}`)}`} active={mode === m} gradient={mode === m ? T.primarySoft : undefined} onPress={() => setMode(m)} />
              ))}
            </View>

            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

            <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("theme")}</Text>
            <View style={styles.themeRow}>
              {THEME_NAMES.map((n) => (
                <ThemeCard key={n} name={n} label={t(`theme_${n}`)} active={name === n} T={T} onPress={() => setTheme(n)} />
              ))}
            </View>

            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

            <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("language")}</Text>
            <View style={styles.pillWrap}>
              {LANGS.map((l) => (
                <Pill key={l.code} label={`${l.flag} ${l.label}`} active={lang === l.code} onPress={() => setLang(l.code)} />
              ))}
            </View>

            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />

            <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("gender")}</Text>
            <View style={styles.pillWrap}>
              <Pill label={t("male")} active={gender === "male"} onPress={() => pickGender("male")} />
              <Pill label={t("female")} active={gender === "female"} onPress={() => pickGender("female")} />
              <Pill label={t("other")} active={gender === "other"} onPress={() => pickGender("other")} />
            </View>
          </GlassCard>
        </Section>

        {/* Bildirim tercihleri */}
        <Section title={t("notif_prefs")} accent={T.cyan} openKey="notif" current={open} onToggle={toggle} delay={80}>
          <GlassCard padded>
                <Text style={[Type.body, { color: T.textDim, marginBottom: Space.md }]}>{t("notif_help")}</Text>
                <View style={styles.pillWrap}>
                  <Pill label={t("notif_all")} active={prefs.mode === "all"} onPress={() => setNotifMode("all")} />
                  <Pill label={t("notif_custom")} active={prefs.mode === "custom"} gradient={T.primarySoft} onPress={() => setNotifMode("custom")} />
                  <Pill label={t("notif_off")} active={prefs.mode === "off"} onPress={() => setNotifMode("off")} />
                </View>
                {prefs.mode === "custom" && (
                  <Animated.View entering={FadeInDown.duration(260)}>
                    <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("notif_pick_cities")}</Text>
                    <View style={styles.pillWrap}>
                      {CITIES.map((c) => (
                        <Pill key={c} label={c} active={prefs.cities.includes(c)} gradient={T.primarySoft} onPress={() => toggleNotifCity(c)} />
                      ))}
                    </View>
                    <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("notif_pick_cats")}</Text>
                    <View style={styles.pillWrap}>
                      {CATEGORIES.map((c) => (
                        <Pill key={c.key} label={`${c.emoji} ${c.label}`} active={prefs.categories.includes(c.key)} gradient={c.gradient} onPress={() => toggleNotifCat(c.key)} />
                      ))}
                    </View>
                  </Animated.View>
                )}
                {savedAt > 0 && (
                  <Animated.Text key={savedAt} entering={FadeInDown.duration(240)} style={[Type.label, { color: T.cyan, marginTop: Space.md, textAlign: "center" }]}>
                    {t("notif_saved")}
                  </Animated.Text>
                )}
          </GlassCard>
        </Section>

        {/* Bağlantılar */}
        <Section title={t("discover_links")} accent={T.pink} openKey="links" current={open} onToggle={toggle} delay={120}>
          <GlassCard padded>
            <View style={{ gap: Space.md }}>
              <GradientButton label={t("open_site")} icon="🌐" gradient={T.primarySoft} onPress={openSite} />
              <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
              <GradientButton label={t("suggest_event")} icon="✨" gradient={T.primarySoft} onPress={openSite} />
              <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
              <GradientButton label={t("feedback")} icon="💬" gradient={T.primarySoft} onPress={openSite} />
            </View>
          </GlassCard>
        </Section>

        {/* Hakkında */}
        <Section title={t("about")} accent={T.gold} openKey="about" current={open} onToggle={toggle} delay={160}>
          <View style={{ paddingHorizontal: 2 }}>
            <Text style={[Type.body, { color: T.textDim }]}>{t("about_text")}</Text>
            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />
            <Text style={[Type.label, { color: T.textFaint }]}>{t("version")}</Text>
          </View>
        </Section>

        {/* Çıkış — her zaman erişilebilir (akordeon dışında) */}
        {user ? (
          <Animated.View entering={FadeInDown.duration(450).delay(200)}>
            <Pressable onPress={() => { impactH(); signOut(); router.back(); }} style={[styles.signOut, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
              <Text style={[Type.title, { color: T.pink }]}>{t("sign_out")}</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Space.lg },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  themeRow: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  themeCard: { flexBasis: "30%", flexGrow: 1, minWidth: 88, alignItems: "center", gap: Space.sm, paddingVertical: Space.md, paddingHorizontal: Space.sm, borderRadius: Radius.md },
  themeDot: { width: 34, height: 34, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  themeCheck: { color: "#fff", fontSize: 16, fontWeight: "800" },
  hairline: { height: StyleSheet.hairlineWidth * 2 },
  signOut: { marginTop: Space.lg, paddingVertical: 14, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center" },
});
