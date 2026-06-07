import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Radius, Type, glow } from "@/theme/aurora";
import { PEOPLE, type Person } from "@/lib/people";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH, impactH } from "@/lib/haptics";
import { scheduleProximityPing } from "@/lib/notify";
import { StoryAvatar } from "@/components/StoryAvatar";
import { StoryViewer } from "@/components/StoryViewer";

/**
 * Deterministik "canlı presence": gerçek backend yok. Dakikaya bağlı bir tohum ile
 * kişilerin online durumunu yumuşakça değiştirir; ~20 sn'de bir yeniden hesaplanır.
 * Math.random kullanmıyoruz → aynı dakikada herkeste aynı sonuç, ama dakika geçtikçe
 * birkaç kişi "canlı" şekilde online olur / offline olur.
 */
function presenceFor(person: Person, minute: number): boolean {
  // id'den sabit bir sayı türet
  let h = 0;
  for (let i = 0; i < person.id.length; i++) h = (h * 31 + person.id.charCodeAt(i)) >>> 0;
  // Temel olarak baseline online kişiler daha sık online; offline'lar nadiren parlar.
  const phase = (h % 7) + 2; // 2..8 dakikalık döngü
  const wave = (minute + (h % phase)) % phase;
  const lit = wave < (person.online ? phase - 1 : 1); // online baseline → neredeyse hep açık
  return lit;
}

/** Nabız gibi atan yeşil online noktası. */
function PulseDot({ color, border, size = 16 }: { color: string; border: string; size?: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withSequence(withTiming(1.35, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true);
  }, [s]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 2.2 - s.value }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color },
          ring,
        ]}
      />
      <View
        style={{
          width: size - 4,
          height: size - 4,
          borderRadius: (size - 4) / 2,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: border,
        }}
      />
    </View>
  );
}

function PersonCard({ person, online, onOpenStory }: { person: Person; online: boolean; onOpenStory: (p: Person) => void }) {
  const { t: T } = useTheme();
  const openAvatar = () => {
    tapH();
    if (person.hasStory) onOpenStory(person);
    else router.push(`/kisi/${person.id}`);
  };
  return (
    <Pressable
      onPress={() => {
        tapH();
        router.push(`/kisi/${person.id}`);
      }}
      style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }]}
    >
      <View>
        <StoryAvatar
          uri={person.avatar}
          name={person.name}
          size={60}
          hasStory={person.hasStory}
          onPress={openAvatar}
        />
        {online && (
          <View style={styles.onlineSlot}>
            <PulseDot color={T.success} border={T.bg} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[Type.title, { color: T.text }]}>
            {person.name}, {person.age}
          </Text>
          <Text style={[Type.label, { color: T.textFaint }]}>· {person.distanceKm} km</Text>
        </View>
        <Text style={[Type.label, { color: T.textDim }]} numberOfLines={1}>
          {person.bio}
        </Text>
        <View style={styles.chips}>
          {person.interests.map((i) => (
            <View key={i} style={styles.chip}>
              <Text style={[Type.micro, { color: T.primary }]}>{i}</Text>
            </View>
          ))}
        </View>
      </View>
      <LinearGradient colors={T.primarySoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.msgBtn, glow(T.indigo, 14, 0.5)]}>
        <Text style={{ fontSize: 16 }}>💬</Text>
      </LinearGradient>
    </Pressable>
  );
}

function OnlineBubble({ person, success, bg, text, onOpenStory }: { person: Person; success: string; bg: string; text: string; onOpenStory: (p: Person) => void }) {
  return (
    <Pressable
      onPress={() => {
        tapH();
        router.push(`/kisi/${person.id}`);
      }}
      style={styles.bubble}
    >
      <View>
        <StoryAvatar
          uri={person.avatar}
          name={person.name}
          size={52}
          hasStory={person.hasStory}
          onPress={() => {
            tapH();
            if (person.hasStory) onOpenStory(person);
            else router.push(`/kisi/${person.id}`);
          }}
        />
        <View style={styles.bubbleDotSlot}>
          <PulseDot color={success} border={bg} size={14} />
        </View>
      </View>
      <Text style={[Type.micro, { color: text }]} numberOfLines={1}>
        {person.name}
      </Text>
    </Pressable>
  );
}

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();

  // Canlı presence saati: dakika değişince + ~20 sn'de bir yenile.
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    const id = setInterval(() => setMinute(Math.floor(Date.now() / 60000)), 20000);
    return () => clearInterval(id);
  }, []);

  const [btDismissed, setBtDismissed] = useState(false);
  const [onlyOnline, setOnlyOnline] = useState(false);
  // Story halkalı kişiye dokununca açılan tam ekran izleyici.
  const [viewStory, setViewStory] = useState<Person | null>(null);
  const veryClose = PEOPLE.find((p) => p.distanceKm <= 1);

  // Her kişi için canlı online durumu (id -> boolean).
  const onlineMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const p of PEOPLE) m[p.id] = presenceFor(p, minute);
    return m;
  }, [minute]);

  const onlinePeople = useMemo(() => PEOPLE.filter((p) => onlineMap[p.id]), [onlineMap]);
  const onlineCount = onlinePeople.length;

  // Ana liste: online olanlar üstte; toggle açıksa sadece online.
  const listData = useMemo(() => {
    const base = onlyOnline ? PEOPLE.filter((p) => onlineMap[p.id]) : PEOPLE;
    return [...base].sort((a, b) => Number(onlineMap[b.id]) - Number(onlineMap[a.id]));
  }, [onlineMap, onlyOnline]);

  const enableBt = async () => {
    impactH();
    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS");
      } catch {
        try {
          await Linking.openSettings();
        } catch {
          /* yoksay */
        }
      }
    } else {
      try {
        await Linking.openSettings();
      } catch {
        /* yoksay */
      }
    }
    if (veryClose) scheduleProximityPing(veryClose.name);
  };

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <FlatList
        data={listData}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 130, paddingHorizontal: 16, gap: 12 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14, gap: 14 }}>
            <Animated.View entering={FadeInDown.duration(450)}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[Type.h1, { color: T.text }]}>{t("nearby")}</Text>
                  <Text style={[Type.label, { color: T.textFaint, marginTop: 4 }]}>
                    {t("nearby_sub", { count: PEOPLE.length, online: onlineCount })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    tapH();
                    router.push("/esles");
                  }}
                  style={{ borderRadius: Radius.pill, overflow: "hidden" }}
                >
                  <LinearGradient
                    colors={T.primarySoft}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.matchBtn, glow(T.pink, 14, 0.5)]}
                  >
                    <Text style={{ fontSize: 14 }}>💜</Text>
                    <Text style={[Type.label, { color: "#FFFFFF" }]}>{t("match_title")}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>

            {/* ── Çevrimiçi şeridi ── */}
            {onlineCount > 0 && (
              <Animated.View entering={FadeInDown.delay(40).duration(450)} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[Type.title, { color: T.text }]}>{t("online_now")}</Text>
                    <View style={[styles.onlineTag, { backgroundColor: T.success + "22", borderColor: T.success + "55" }]}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.success }} />
                      <Text style={[Type.micro, { color: T.success }]}>{t("online_count", { count: onlineCount })}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      tapH();
                      setOnlyOnline((v) => !v);
                    }}
                    style={[
                      styles.pill,
                      onlyOnline
                        ? { backgroundColor: T.primary, borderColor: T.primary }
                        : { backgroundColor: "transparent", borderColor: T.hairline },
                    ]}
                  >
                    <Text style={[Type.micro, { color: onlyOnline ? "#FFFFFF" : T.textDim }]}>
                      {t("online_now")}
                    </Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 14, paddingVertical: 2, paddingRight: 8 }}
                >
                  {onlinePeople.map((p) => (
                    <OnlineBubble key={p.id} person={p} success={T.success} bg={T.bg} text={T.text} onOpenStory={setViewStory} />
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {veryClose && !btDismissed && (
              <Animated.View entering={FadeInDown.delay(80).duration(450)}>
                <LinearGradient
                  colors={T.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.btCard, glow(T.primary, 18, 0.5)]}
                >
                  <Text style={[Type.title, { color: "#FFFFFF" }]}>{t("bt_nearby_title")}</Text>
                  <Text style={[Type.body, { color: "#F5F3FF", marginTop: 6 }]}>
                    {t("bt_suggest", { name: veryClose.name })}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                    <Pressable onPress={enableBt} style={[styles.btBtn, { backgroundColor: "#FFFFFF" }]}>
                      <Text style={[Type.label, { color: T.bg }]}>{t("open_bluetooth")}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        tapH();
                        setBtDismissed(true);
                      }}
                      style={[styles.btBtn, { backgroundColor: "rgba(255,255,255,0.18)" }]}
                    >
                      <Text style={[Type.label, { color: "#FFFFFF" }]}>{t("bt_later")}</Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              </Animated.View>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(420)}>
            <PersonCard person={item} online={!!onlineMap[item.id]} onOpenStory={setViewStory} />
          </Animated.View>
        )}
      />
      {/* Story izleyici — halkalı avatara dokununca; sol üst avatardan profile gidilir. */}
      <StoryViewer person={viewStory} onClose={() => setViewStory(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 10,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  onlineSlot: { position: "absolute", right: -3, bottom: -3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: { backgroundColor: "rgba(168,85,247,0.14)", borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  msgBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  matchBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill,
  },
  btCard: { borderRadius: Radius.lg, padding: 16 },
  btBtn: { borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
  onlineTag: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2,
  },
  bubble: { width: 64, alignItems: "center", gap: 6 },
  bubbleAvatar: { width: 60, height: 60, borderRadius: 30 },
  bubbleDotSlot: { position: "absolute", right: -1, bottom: -1 },
});
