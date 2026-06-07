import React, { useState } from "react";
import { FlatList, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
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

function PersonCard({ person }: { person: Person }) {
  const { t: T } = useTheme();
  return (
    <Pressable
      onPress={() => {
        tapH();
        router.push(`/kisi/${person.id}`);
      }}
      style={[styles.card, { backgroundColor: T.surface, borderColor: T.hairline }]}
    >
      <View>
        <Image
          source={{ uri: person.avatar }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
          recyclingKey={person.id}
          cachePolicy="memory-disk"
        />
        {person.online && <View style={[styles.online, { backgroundColor: T.success, borderColor: T.bg }]} />}
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

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const online = PEOPLE.filter((p) => p.online).length;

  const [btDismissed, setBtDismissed] = useState(false);
  const veryClose = PEOPLE.find((p) => p.distanceKm <= 1);

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
        data={PEOPLE}
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
                    {t("nearby_sub", { count: PEOPLE.length, online })}
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
            <PersonCard person={item} />
          </Animated.View>
        )}
      />
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
  online: {
    position: "absolute", right: -1, bottom: -1, width: 16, height: 16, borderRadius: 8,
    borderWidth: 3,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: { backgroundColor: "rgba(168,85,247,0.14)", borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  msgBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  matchBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill,
  },
  btCard: { borderRadius: Radius.lg, padding: 16 },
  btBtn: { borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 9 },
});
