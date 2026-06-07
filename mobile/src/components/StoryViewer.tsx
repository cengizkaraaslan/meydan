import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { tapH } from "@/lib/haptics";
import { StoryAvatar } from "@/components/StoryAvatar";
import type { Person } from "@/lib/people";

const STORY_MS = 5000;

/**
 * Instagram-tarzı tam ekran story izleyici. Mock kişilerde gerçek story medyası yok →
 * kişinin avatarı tam ekran gösterilir (gerçek story'ler ileride DB ile gelecek).
 * Sol üstteki avatara/isme dokununca kişinin profiline gider (tıpkı Instagram).
 * Üstteki çubuk ~5sn'de dolar ve otomatik kapanır; boşluğa dokununca kapanır.
 */
export function StoryViewer({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const p = useSharedValue(0);

  useEffect(() => {
    if (!person) return;
    p.value = 0;
    p.value = withTiming(1, { duration: STORY_MS }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [person, onClose, p]);

  const progStyle = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  const goProfile = () => {
    if (!person) return;
    const id = person.id;
    tapH();
    onClose();
    router.push(`/kisi/${id}`);
  };

  return (
    <Modal visible={!!person} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} style={styles.viewer}>
        {/* Boşluğa dokun → kapat */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {person ? (
          <>
            <Image source={{ uri: person.avatar }} style={styles.img} contentFit="cover" transition={200} />

            {/* İlerleme çubuğu */}
            <View style={[styles.barTop, { top: insets.top + 8 }]}>
              <Animated.View style={[styles.progress, progStyle]} />
            </View>

            {/* Sol üst: avatar + isim → profile git (Instagram gibi) */}
            <Pressable onPress={goProfile} style={[styles.info, { top: insets.top + 22 }]} hitSlop={8}>
              <StoryAvatar uri={person.avatar} name={person.name} size={38} online={person.online} />
              <Text style={[Type.title, { color: "#fff" }]}>{person.name}</Text>
            </Pressable>

            {/* Alt: profile git butonu */}
            <Pressable onPress={goProfile} style={[styles.profileBtn, { bottom: insets.bottom + 28 }]}>
              <Text style={[Type.title, { color: "#fff" }]}>👤 {person.name} · {t("person_about")} →</Text>
            </Pressable>
          </>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
  barTop: {
    position: "absolute", left: 12, right: 12, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden",
  },
  progress: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2, backgroundColor: "#fff" },
  info: { position: "absolute", left: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  profileBtn: {
    position: "absolute", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: Radius.pill,
  },
});
