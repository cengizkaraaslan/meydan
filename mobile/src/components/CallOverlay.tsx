import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StoryAvatar } from "@/components/StoryAvatar";
import { Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH } from "@/lib/haptics";
import type { VoiceCall } from "@/lib/voiceCall";

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** Tam ekran sesli arama arayüzü (gelen/giden/bağlı). Ses otomatik çalar (audio-only). */
export function CallOverlay({
  call,
  name,
  avatar,
}: {
  call: VoiceCall;
  name: string;
  avatar?: string | null;
}) {
  const { t: T } = useTheme();
  const insets = useSafeAreaInsets();
  const visible = call.status !== "idle";
  if (!visible) return null;

  const subtitle =
    call.status === "incoming"
      ? "Sesli arama…"
      : call.status === "outgoing"
        ? "Aranıyor…"
        : call.status === "connecting"
          ? "Bağlanıyor…"
          : call.status === "connected"
            ? mmss(call.durationSec)
            : "Görüşme bitti";

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={call.hangup}>
      <View style={[styles.root, { backgroundColor: T.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.center}>
          <StoryAvatar uri={avatar} name={name} size={132} />
          <Text style={[Type.h1, { color: T.text, marginTop: 22 }]} numberOfLines={1}>{name}</Text>
          <Text style={[Type.body, { color: T.textDim, marginTop: 8 }]}>{subtitle}</Text>
        </View>

        {/* Aksiyonlar */}
        {call.status === "incoming" ? (
          <View style={styles.row}>
            <Action color="#FF3B30" icon="call" rotate label="Reddet" onPress={() => { tapH(); call.decline(); }} T={T} />
            <Action color="#34C759" icon="call" label="Kabul et" onPress={() => { tapH(); call.accept(); }} T={T} />
          </View>
        ) : (
          <View style={styles.row}>
            <Action
              color={call.muted ? T.primary : T.surfaceStrong}
              icon={call.muted ? "mic-off" : "mic"}
              label={call.muted ? "Sessiz" : "Mikrofon"}
              onPress={() => { tapH(); call.toggleMute(); }}
              T={T}
              small
            />
            <Action
              color={call.speakerOn ? T.primary : T.surfaceStrong}
              icon={call.speakerOn ? "volume-high" : "volume-medium"}
              label="Hoparlör"
              onPress={() => { tapH(); call.toggleSpeaker(); }}
              T={T}
              small
            />
            <Action color="#FF3B30" icon="call" rotate label="Bitir" onPress={() => { tapH(); call.hangup(); }} T={T} />
          </View>
        )}
      </View>
    </Modal>
  );
}

function Action({
  color,
  icon,
  label,
  onPress,
  rotate,
  small,
  T,
}: {
  color: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  rotate?: boolean;
  small?: boolean;
  T: ReturnType<typeof useTheme>["t"];
}) {
  const size = small ? 60 : 72;
  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      <Pressable
        onPress={onPress}
        style={[
          { width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: color },
          glow(color, 12, 0.4),
        ]}
      >
        <Ionicons name={icon} size={small ? 26 : 30} color="#fff" style={rotate ? { transform: [{ rotate: "135deg" }] } : undefined} />
      </Pressable>
      <Text style={[Type.micro, { color: T.textDim }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  row: { flexDirection: "row", gap: 48, alignItems: "center", justifyContent: "center" },
});
