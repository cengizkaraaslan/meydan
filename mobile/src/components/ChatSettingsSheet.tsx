import React from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Radius, Space, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH, impactH } from "@/lib/haptics";
import { useChatPrefs, setChatPref, type ChatPrefs } from "@/lib/chatPrefs";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Sohbet gizlilik ayarları (son görülme / yazıyor / okundu) — alttan açılan sayfa. */
export function ChatSettingsSheet({ visible, onClose }: Props) {
  const { t: T } = useTheme();
  const insets = useSafeAreaInsets();
  const prefs = useChatPrefs();

  const toggle = (key: keyof ChatPrefs, value: boolean) => {
    impactH();
    void setChatPref(key, value);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { backgroundColor: T.bgElevated, borderColor: T.hairline, paddingBottom: insets.bottom + 18 }]}
        >
          <View style={[styles.handle, { backgroundColor: T.hairline }]} />
          <View style={styles.headRow}>
            <Text style={[Type.h2, { color: T.text }]}>Sohbet ayarları</Text>
            <Pressable onPress={() => { tapH(); onClose(); }} hitSlop={10}>
              <Text style={{ fontSize: 22, color: T.textDim }}>✕</Text>
            </Pressable>
          </View>
          <Text style={[Type.label, { color: T.textFaint, marginBottom: 10 }]}>
            Gizlilik tercihlerin tüm sohbetlerine uygulanır.
          </Text>

          <Animated.View entering={FadeInDown.duration(280)}>
            <Row
              T={T}
              label="Son görülmeyi gizle"
              help="Karşı taraf en son ne zaman aktif olduğunu ve çevrimiçi olduğunu göremez."
              value={prefs.hideLastSeen}
              onChange={(v) => toggle("hideLastSeen", v)}
            />
            <Row
              T={T}
              label="Yazıyor göstergesini gizle"
              help="Mesaj yazarken karşı tarafta 'yazıyor…' görünmez."
              value={prefs.hideTyping}
              onChange={(v) => toggle("hideTyping", v)}
            />
            <Row
              T={T}
              label="Okundu bilgisini gizle"
              help="Mesajları okuduğunda karşı tarafa okundu (mavi tik) gönderilmez."
              value={prefs.hideReadReceipts}
              onChange={(v) => toggle("hideReadReceipts", v)}
              last
            />
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  T, label, help, value, onChange, last,
}: {
  T: ReturnType<typeof useTheme>["t"];
  label: string;
  help: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && { borderBottomColor: T.hairline, borderBottomWidth: StyleSheet.hairlineWidth * 2 }]}>
      <View style={{ flex: 1, paddingRight: Space.md }}>
        <Text style={[Type.title, { color: T.text }]}>{label}</Text>
        <Text style={[Type.label, { color: T.textFaint, marginTop: 2 }]}>{help}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: T.primary, false: T.hairline }} thumbColor="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
});
