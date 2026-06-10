import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Space, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH } from "@/lib/haptics";
import { courseEmoji } from "@/lib/courses";
import { API_BASE } from "@/lib/api";

/**
 * Belediye ücretsiz kurs DETAY ekranı. Kurs satırına dokununca artık dış linke
 * doğrudan gitmek yerine bu uygulama-içi ekran açılır; "Daha fazla bilgi" butonu
 * dış belediye sayfasına yönlendirir.
 */
export default function CourseDetailScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const params = useLocalSearchParams<{
    name?: string;
    center?: string;
    schedule?: string;
    image?: string;
    provider?: string;
    city?: string;
    url?: string;
    note?: string;
  }>();

  const name = params.name ?? "";
  const center = params.center ?? "";
  const schedule = params.schedule ?? "";
  const image = params.image ?? "";
  const provider = params.provider ?? "";
  const city = params.city ?? "";
  const url = params.url ?? "";
  const note = params.note ?? "";
  // İŞKUR ulusal kurs/İEP — belediye kursundan farklı metin/CTA.
  const isIskur = /İŞKUR|ISKUR|iskur/i.test(provider);

  const grad: readonly [string, string] = [T.violet, T.blue];

  const openMore = () => {
    tapH();
    const target = url || `${API_BASE}/kurslar`;
    Linking.openURL(target).catch(() => {});
  };

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 60,
          paddingHorizontal: 16,
          flexGrow: 1,
        }}
      >
        {/* Başlık + geri */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => { tapH(); router.back(); }}
            hitSlop={10}
            accessibilityLabel="Geri"
            style={[styles.circleBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          >
            <Text style={{ color: T.text, fontSize: 18, fontWeight: "700" }}>←</Text>
          </Pressable>
          <Text style={[Type.h1, { color: T.text }]}>Kurs</Text>
          <View style={{ width: 40 }} />
        </View>

        <Animated.View entering={FadeInDown.duration(420)} style={{ gap: Space.lg }}>
          {/* Görsel veya emoji'li tema gradient */}
          {image ? (
            <Image
              source={{ uri: image }}
              style={[styles.hero, { backgroundColor: T.surfaceStrong }]}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <LinearGradient
              colors={grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, styles.heroCenter, glow(grad[0], 18, 0.4)]}
            >
              <Text style={{ fontSize: 92 }}>{courseEmoji(name)}</Text>
            </LinearGradient>
          )}

          {/* Bilgiler */}
          <View style={{ gap: Space.sm }}>
            <Text style={[Type.h1, { color: T.text }]}>{name}</Text>

            {center ? (
              <Text style={[Type.body, { color: T.textDim }]}>📍 {center}</Text>
            ) : null}
            {schedule ? (
              <Text style={[Type.body, { color: T.textDim }]}>🕐 {schedule}</Text>
            ) : null}
            {provider ? (
              <Text style={[Type.body, { color: T.textDim }]}>
                🏛️ {provider}{city ? ` · ${city}` : ""}
              </Text>
            ) : city ? (
              <Text style={[Type.body, { color: T.textDim }]}>📍 {city}</Text>
            ) : null}

            {note ? (
              <Text style={[Type.body, { color: T.textDim }]}>ℹ️ {note}</Text>
            ) : null}

            <Text style={[Type.label, { color: T.textFaint, marginTop: Space.xs }]}>
              {isIskur
                ? "İŞKUR mesleki eğitim kursu / İşbaşı Eğitim Programı (ücretsiz, cep harçlığı + sigorta). Başvuru ve güncel bilgi için İŞKUR e-Şube'ye git."
                : "Belediyelerin ücretsiz meslek ve sanat kursu. Kayıt ve güncel bilgiler için belediye sayfasına göz at."}
            </Text>
          </View>

          {/* Daha fazla bilgi → dış URL */}
          <Pressable onPress={openMore} accessibilityRole="button">
            {({ pressed }) => (
              <LinearGradient
                colors={T.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cta, glow(T.primary, 18, 0.5), pressed && { opacity: 0.9 }]}
              >
                <Text style={[Type.title, { color: "#fff" }]}>{isIskur ? "İŞKUR'da başvur →" : "Daha fazla bilgi →"}</Text>
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Space.lg },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth * 2 },
  hero: { width: "100%", height: 200, borderRadius: Radius.lg },
  heroCenter: { alignItems: "center", justifyContent: "center" },
  cta: { paddingVertical: 16, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
});
