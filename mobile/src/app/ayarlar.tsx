import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { ALL_CITIES, districtsFor } from "@/lib/location";
import { usePrefs, replayTour } from "@/lib/prefs";
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

/** Anahtarlı ayar satırı (ses/titreşim/animasyon). */
function ToggleRow({ label, help, value, onValueChange, T, accent }: { label: string; help?: string; value: boolean; onValueChange: (v: boolean) => void; T: Palette; accent: string }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: Space.md }}>
        <Text style={[Type.title, { color: T.text }]}>{label}</Text>
        {help ? <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>{help}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: accent, false: T.hairline }} thumbColor="#fff" />
    </View>
  );
}

/** Dokunmatik bağlantı/aksiyon satırı (yasal & destek). */
function LinkRow({ icon, label, onPress, T, danger }: { icon: string; label: string; onPress: () => void; T: Palette; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.linkRow}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[Type.title, { color: danger ? T.pink : T.text, flex: 1 }]}>{label}</Text>
      <Text style={[Type.h2, { color: T.textFaint }]}>›</Text>
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
  const prefs = usePrefs();

  // Akordeon: aynı anda tek bölüm açık. Açılışta "Şehir + İlçe" açık gelsin
  // (uzun içeriği alttaki boşluğu doldurur → ekran dolu/düzgün görünür).
  const [open, setOpen] = useState<string | null>("city");
  const toggle = (key: string) => { tapH(); setOpen((o) => (o === key ? null : key)); };
  const [notif, setNotif] = useState<NotifPrefs>({ mode: "all", cities: [], categories: [] });
  const [savedAt, setSavedAt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  // Çıkış — kısa da olsa loading göster (AsyncStorage temizliği + state güncellemesi).
  const doSignOut = async () => {
    if (loggingOut) return;
    impactH();
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      router.back();
    }
  };

  // İlçe seçimi (şehre bağlı) — cihazda saklanır + best-effort DB'ye senkron.
  const [district, setDistrictState] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem("meydanfest:district").then((d) => setDistrictState(d));
  }, []);

  // Seçili şehrin ilçeleri: API → boşsa yerel yedek. Şehir yoksa boş.
  useEffect(() => {
    if (!city) { setDistricts([]); return; }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/districts?city=${encodeURIComponent(city)}`);
        const json = (await res.json()) as { districts?: string[] };
        const apiList = Array.isArray(json.districts) ? json.districts : [];
        if (alive) setDistricts(apiList.length ? apiList : districtsFor(city));
      } catch {
        if (alive) setDistricts(districtsFor(city));
      }
    })();
    return () => { alive = false; };
  }, [city]);

  const pickDistrict = (d: string) => {
    tapH();
    // d boş ("Tüm ilçeler") → temizle; aynı ilçeye tekrar dokun → temizle; aksi → seç.
    const next = d && district !== d ? d : null;
    setDistrictState(next);
    if (next) AsyncStorage.setItem("meydanfest:district", next);
    else AsyncStorage.removeItem("meydanfest:district");
    syncProfile({ city, district: next });
  };

  useEffect(() => {
    let alive = true;
    getNotifPrefs().then((p) => { if (alive) setNotif(p); });
    return () => { alive = false; };
  }, []);

  const persistPrefs = (next: NotifPrefs) => {
    setNotif(next);
    setNotifPrefs(next);
    setSavedAt(Date.now());
    impactH();
  };
  const setNotifMode = (m: NotifPrefs["mode"]) => persistPrefs({ ...notif, mode: m });
  const toggleNotifCity = (c: string) => {
    const has = notif.cities.includes(c);
    persistPrefs({ ...notif, cities: has ? notif.cities.filter((x) => x !== c) : [...notif.cities, c] });
  };
  const toggleNotifCat = (key: string) => {
    const has = notif.categories.includes(key);
    persistPrefs({ ...notif, categories: has ? notif.categories.filter((x) => x !== key) : [...notif.categories, key] });
  };
  const pickCity = (c: string) => {
    const next = city === c ? null : c;
    setCity(next);
    syncProfile({ city: next, district: null });
    // Şehir değişince ilçe sıfırlanır.
    setDistrictState(null);
    AsyncStorage.removeItem("meydanfest:district");
  };
  const pickGender = (g: Gender) => {
    setGender(g);
    setTheme(themeForGender(g));
    syncProfile({ gender: g });
  };
  const openSite = () => WebBrowser.openBrowserAsync(API_BASE);

  // ── Yasal & Destek aksiyonları ──
  const PKG = "app.meydanfest";
  const PLAY_URL = `https://play.google.com/store/apps/details?id=${PKG}`;
  const openPrivacy = () => WebBrowser.openBrowserAsync(`${API_BASE}/privacy`);
  const openTerms = () => WebBrowser.openBrowserAsync(`${API_BASE}/terms`);
  const reportBug = () => Linking.openURL(`mailto:cengiz7karaaslan@gmail.com?subject=${encodeURIComponent("MeydanFest — Hata/İletişim")}`).catch(() => {});
  const shareApp = () => Share.share({ message: `${t("share_app_msg")}\n${PLAY_URL}` }).catch(() => {});
  const rateApp = () => Linking.openURL(`market://details?id=${PKG}`).catch(() => WebBrowser.openBrowserAsync(PLAY_URL));
  const wipeAll = async () => {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith("meydanfest:"));
    await AsyncStorage.multiRemove(mine);
    signOut();
    router.back();
  };
  const confirmDelete = () => {
    Alert.alert(t("delete_account_q"), t("delete_account_body"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete_account"), style: "destructive", onPress: () => { wipeAll(); } },
    ]);
  };
  const doReplayTour = () => { impactH(); replayTour(); router.back(); };

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

        {/* Şehir + İlçe — tüm 81 il + şehre bağlı ilçeler (cihazda + DB'de tutulur) */}
        <Section
          title={`${t("detected_city")}  📍 ${city ?? "—"}${district ? " · " + district : ""}`}
          accent={T.blue}
          openKey="city"
          current={open}
          onToggle={toggle}
        >
          <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("select_city")}</Text>
          <View style={styles.pillWrap}>
            {ALL_CITIES.map((c) => (
              <Pill key={c} label={c} active={city === c} gradient={T.primarySoft} onPress={() => pickCity(c)} />
            ))}
          </View>
          {city && districts.length > 0 ? (
            <>
              <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />
              <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("district")}</Text>
              <View style={styles.pillWrap}>
                <Pill label={t("all_districts")} active={district === null} onPress={() => pickDistrict("")} />
                {districts.map((d) => (
                  <Pill key={d} label={d} active={district === d} gradient={T.primarySoft} onPress={() => pickDistrict(d)} />
                ))}
              </View>
            </>
          ) : null}
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

        {/* Ses & Erişilebilirlik */}
        <Section title={t("settings_sound_access")} accent={T.indigo} openKey="sound" current={open} onToggle={toggle} delay={60}>
          <GlassCard padded>
            <ToggleRow label={t("sound_fx")} value={prefs.sound} onValueChange={(v) => { tapH(); prefs.setSound(v); }} T={T} accent={T.primary} />
            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.sm }]} />
            <ToggleRow label={t("haptics_fx")} value={prefs.haptics} onValueChange={(v) => { prefs.setHaptics(v); tapH(); }} T={T} accent={T.primary} />
            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.sm }]} />
            <ToggleRow label={t("reduce_motion")} help={t("reduce_motion_help")} value={prefs.reduceMotion} onValueChange={(v) => { tapH(); prefs.setReduceMotion(v); }} T={T} accent={T.primary} />
            <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.sm }]} />
            <LinkRow icon="🎬" label={t("replay_tour")} onPress={doReplayTour} T={T} />
          </GlassCard>
        </Section>

        {/* Bildirim tercihleri */}
        <Section title={t("notif_prefs")} accent={T.cyan} openKey="notif" current={open} onToggle={toggle} delay={80}>
          <GlassCard padded>
                <Text style={[Type.body, { color: T.textDim, marginBottom: Space.md }]}>{t("notif_help")}</Text>
                <View style={styles.pillWrap}>
                  <Pill label={t("notif_all")} active={notif.mode === "all"} onPress={() => setNotifMode("all")} />
                  <Pill label={t("notif_custom")} active={notif.mode === "custom"} gradient={T.primarySoft} onPress={() => setNotifMode("custom")} />
                  <Pill label={t("notif_off")} active={notif.mode === "off"} onPress={() => setNotifMode("off")} />
                </View>
                {notif.mode === "custom" && (
                  <Animated.View entering={FadeInDown.duration(260)}>
                    <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("notif_pick_cities")}</Text>
                    <View style={styles.pillWrap}>
                      {CITIES.map((c) => (
                        <Pill key={c} label={c} active={notif.cities.includes(c)} gradient={T.primarySoft} onPress={() => toggleNotifCity(c)} />
                      ))}
                    </View>
                    <View style={[styles.hairline, { backgroundColor: T.hairline, marginVertical: Space.md }]} />
                    <Text style={[Type.label, { color: T.textFaint, marginBottom: Space.sm }]}>{t("notif_pick_cats")}</Text>
                    <View style={styles.pillWrap}>
                      {CATEGORIES.map((c) => (
                        <Pill key={c.key} label={`${c.emoji} ${c.label}`} active={notif.categories.includes(c.key)} gradient={c.gradient} onPress={() => toggleNotifCat(c.key)} />
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

        {/* Yasal & Destek */}
        <Section title={t("legal_support")} accent={T.gold} openKey="legal" current={open} onToggle={toggle} delay={140}>
          <GlassCard padded>
            <LinkRow icon="🔒" label={t("privacy_policy")} onPress={openPrivacy} T={T} />
            <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
            <LinkRow icon="📜" label={t("terms_of_use")} onPress={openTerms} T={T} />
            <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
            <LinkRow icon="🐞" label={t("report_bug")} onPress={reportBug} T={T} />
            <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
            <LinkRow icon="↗" label={t("share_app")} onPress={shareApp} T={T} />
            <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
            <LinkRow icon="★" label={t("rate_app")} onPress={rateApp} T={T} />
            <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
            <LinkRow icon="🗑️" label={t("delete_account")} onPress={confirmDelete} T={T} danger />
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
            <Pressable onPress={doSignOut} disabled={loggingOut} style={[styles.signOut, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }, loggingOut && { opacity: 0.7 }]}>
              {loggingOut ? (
                <ActivityIndicator color={T.pink} />
              ) : (
                <Text style={[Type.title, { color: T.pink }]}>{t("sign_out")}</Text>
              )}
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
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Space.sm },
  linkRow: { flexDirection: "row", alignItems: "center", gap: Space.md, paddingVertical: Space.md },
  signOut: { marginTop: Space.lg, paddingVertical: 14, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: "center" },
});
