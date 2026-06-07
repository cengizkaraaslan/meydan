import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Type, glow } from "@/theme/aurora";
import { PEOPLE, type Person } from "@/lib/people";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { SignInPrompt } from "@/components/SignInPrompt";
import { tapH, impactH, successH } from "@/lib/haptics";

export default function MatchScreen() {
  const insets = useSafeAreaInsets();
  const { t: T, gender } = useTheme();
  const { t } = useT();
  const { user } = useAuth();

  const deck = useMemo<Person[]>(() => {
    if (gender === "male") return PEOPLE.filter((p) => p.gender === "female");
    if (gender === "female") return PEOPLE.filter((p) => p.gender === "male");
    return PEOPLE;
  }, [gender]);

  const [index, setIndex] = useState(0);
  const [matched, setMatched] = useState<Person | null>(null);

  const current = deck[index];

  const next = () => setIndex((i) => i + 1);

  const onPass = () => {
    tapH();
    next();
  };

  const onLike = () => {
    impactH();
    const isMatch = Math.random() < 0.4;
    if (isMatch && current) {
      successH();
      setMatched(current);
    } else {
      next();
    }
  };

  const closeMatch = () => {
    setMatched(null);
    next();
  };

  // #17: Eşleşme yalnızca gerçek kullanıcıya açık. Misafir/oturumsuz ise swipe
  // içeriğini gösterme; kilitli durum + cezbedici giriş modalı. Modal kapanırsa
  // (maybe later) kilit ekranı kalır; kullanıcı geri tuşuyla çıkabilir.
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AuroraBackground />
        <Pressable
          onPress={() => {
            tapH();
            router.back();
          }}
          hitSlop={10}
          style={[styles.backBtn, styles.lockBack, { top: insets.top + 8, backgroundColor: T.surface, borderColor: T.hairline }]}
        >
          <Text style={{ color: T.text, fontSize: 18 }}>‹</Text>
        </Pressable>
        <View style={[styles.lock, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
          <Text style={{ fontSize: 56 }}>🔒</Text>
          <Text style={[Type.h1, { color: T.text, marginTop: 16, textAlign: "center" }]}>
            {t("lock_match_title")}
          </Text>
          <Text style={[Type.body, { color: T.textFaint, marginTop: 8, textAlign: "center" }]}>
            {t("lock_body")}
          </Text>
        </View>
        <SignInPrompt
          visible
          title={t("lock_match_title")}
          onClose={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AuroraBackground />

      {/* Başlık */}
      <Animated.View
        entering={FadeInDown.duration(420)}
        style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, marginBottom: 8 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => {
              tapH();
              router.back();
            }}
            hitSlop={10}
            style={[styles.backBtn, { backgroundColor: T.surface, borderColor: T.hairline }]}
          >
            <Text style={{ color: T.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[Type.h1, { color: T.text }]}>{t("match_title")}</Text>
            <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>{t("match_sub")}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Kart yığını */}
      <View style={styles.deckWrap}>
        {current ? (
          <Animated.View
            key={current.id}
            entering={FadeIn.duration(280)}
            style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }, glow(T.primary, 24, 0.5)]}
          >
            <Image source={{ uri: current.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <LinearGradient
              colors={["transparent", "rgba(8,7,13,0.0)", "rgba(8,7,13,0.92)"]}
              style={StyleSheet.absoluteFill}
            />
            {current.online && (
              <View style={[styles.onlineBadge, { backgroundColor: "rgba(8,7,13,0.55)", borderColor: T.hairline }]}>
                <View style={[styles.onlineDot, { backgroundColor: T.success }]} />
                <Text style={[Type.micro, { color: T.text }]}>{t("online")}</Text>
              </View>
            )}
            <View style={styles.cardInfo}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <Text style={[Type.hero, { color: "#FFFFFF" }]}>
                  {current.name}, {current.age}
                </Text>
              </View>
              <Text style={[Type.label, { color: T.textDim, marginTop: 4 }]}>📍 {current.distanceKm} km</Text>
              <Text style={[Type.body, { color: "#F5F3FF", marginTop: 8 }]}>{current.bio}</Text>
              <View style={styles.chips}>
                {current.interests.map((i) => (
                  <View key={i} style={[styles.chip, { borderColor: T.hairline }]}>
                    <Text style={[Type.micro, { color: T.text }]}>{i}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
            <Text style={{ fontSize: 52 }}>🌙</Text>
            <Text style={[Type.h2, { color: T.text, marginTop: 12, textAlign: "center" }]}>
              {t("no_more_people")}
            </Text>
            <Text style={[Type.body, { color: T.textFaint, marginTop: 6, textAlign: "center" }]}>
              {t("no_more_sub")}
            </Text>
            <Pressable
              onPress={() => {
                tapH();
                setIndex(0);
              }}
              style={{ marginTop: 20, borderRadius: Radius.pill, overflow: "hidden" }}
            >
              <LinearGradient
                colors={T.primarySoft}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.keepBtn, glow(T.primary, 16, 0.5)]}
              >
                <Text style={[Type.title, { color: "#FFFFFF" }]}>{t("keep_swiping")}</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Aksiyon butonları */}
      {current && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
          <Pressable
            onPress={onPass}
            style={[styles.actionBtn, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
          >
            <Text style={{ fontSize: 28, color: T.textDim }}>✕</Text>
          </Pressable>
          <Pressable onPress={onLike} style={{ borderRadius: 40, overflow: "hidden" }}>
            <LinearGradient
              colors={T.primarySoft}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionBtn, styles.likeBtn, glow(T.pink, 20, 0.6)]}
            >
              <Text style={{ fontSize: 30 }}>♥</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* Eşleşme modalı */}
      {matched && (
        <Animated.View entering={FadeIn.duration(320)} style={[StyleSheet.absoluteFill, styles.matchOverlay]}>
          <LinearGradient
            colors={["rgba(8,7,13,0.92)", "rgba(8,7,13,0.97)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ alignItems: "center", paddingHorizontal: 28 }}>
            <Text style={[Type.hero, { color: T.text, textAlign: "center" }]}>{t("its_a_match")}</Text>
            <Text style={[Type.body, { color: T.textDim, textAlign: "center", marginTop: 8 }]}>
              {t("match_body", { name: matched.name })}
            </Text>
            <Image
              source={{ uri: matched.avatar }}
              style={[styles.matchAvatar, { borderColor: T.primary }]}
              contentFit="cover"
              transition={250}
            />
            <Pressable
              onPress={() => {
                impactH();
                const id = matched.id;
                setMatched(null);
                next();
                router.push(`/kisi/${id}`);
              }}
              style={{ marginTop: 28, borderRadius: Radius.pill, overflow: "hidden" }}
            >
              <LinearGradient
                colors={T.primarySoft}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.keepBtn, glow(T.primary, 18, 0.6)]}
              >
                <Text style={[Type.title, { color: "#FFFFFF" }]}>💬 {t("person_message")}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={closeMatch} hitSlop={10} style={{ marginTop: 16 }}>
              <Text style={[Type.label, { color: T.textFaint }]}>{t("keep_swiping")}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  lock: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  lockBack: { position: "absolute", left: 16 },
  deckWrap: { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  card: {
    flex: 1,
    maxHeight: 560,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  onlineBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  cardInfo: { padding: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: Radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  keepBtn: { paddingHorizontal: 28, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 36,
    paddingTop: 18,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  likeBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 0 },
  matchOverlay: { alignItems: "center", justifyContent: "center", zIndex: 10 },
  matchAvatar: { width: 140, height: 140, borderRadius: 70, marginTop: 28, borderWidth: 3 },
});
