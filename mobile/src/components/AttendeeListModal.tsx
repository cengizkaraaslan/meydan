import React from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useCanSeeAges } from "@/lib/dprofile";
import { tapH } from "@/lib/haptics";
import { StoryAvatar } from "@/components/StoryAvatar";
import { type Person } from "@/lib/people";

const { height: SCREEN_H } = Dimensions.get("window");

interface Props {
  visible: boolean;
  title: string; // örn. "👥 Katılacaklar"
  people: Person[];
  gradient: readonly [string, string];
  bottomInset: number;
  /** "Sen" satırı için ipucu metni (kullanıcı bu kategoriyi seçtiyse). */
  meLabel?: string | null;
  onClose: () => void;
  onPressPerson: (id: string) => void;
}

/**
 * Bir RSVP kategorisindeki (mock) kişileri bottom-sheet olarak listeler.
 * Kişiye dokununca onPressPerson çağrılır (profil aç). Tema renkleriyle çizilir,
 * hardcoded siyah yok (scrim hariç — overlay).
 */
export function AttendeeListModal({ visible, title, people, gradient, bottomInset, meLabel, onClose, onPressPerson }: Props) {
  const { t: T } = useTheme();
  const canSeeAges = useCanSeeAges();
  const total = people.length + (meLabel ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: T.bgElevated, paddingBottom: bottomInset + 16 }]}>
        <View style={[styles.handle, { backgroundColor: T.hairline }]} />
        <View style={styles.header}>
          <Text style={[Type.h2, { color: T.text }]} numberOfLines={1}>{title} · {total}</Text>
          <Pressable onPress={() => { tapH(); onClose(); }} hitSlop={10}>
            <Text style={{ color: T.textDim, fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        {total === 0 ? (
          <Text style={[Type.body, { color: T.textFaint, paddingVertical: 24, textAlign: "center" }]}>
            Henüz kimse yok
          </Text>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: SCREEN_H * 0.6 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
          >
            {meLabel ? (
              <View style={[styles.row, { backgroundColor: T.surface, borderColor: T.primary }]}>
                <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.meAvatar}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>★</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[Type.title, { color: T.text }]} numberOfLines={1}>Sen</Text>
                  <Text style={[Type.label, { color: T.primary }]} numberOfLines={1}>{meLabel}</Text>
                </View>
              </View>
            ) : null}

            {people.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => onPressPerson(p.id)}
                style={[styles.row, { backgroundColor: T.surface, borderColor: T.hairline }]}
              >
                <StoryAvatar uri={p.avatar} name={p.name} size={48} hasStory={p.hasStory} online={p.online} />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.title, { color: T.text }]} numberOfLines={1}>{canSeeAges ? `${p.name}, ${p.age}` : p.name}</Text>
                  <Text style={[Type.label, { color: T.textFaint }]} numberOfLines={1}>📍 {p.city} · {p.distanceKm} km</Text>
                </View>
                <Text style={[Type.label, { color: T.primary }]}>→</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: 16, paddingTop: 10 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  meAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
