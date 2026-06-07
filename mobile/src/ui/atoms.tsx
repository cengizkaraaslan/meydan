import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Radius, Type } from "../theme/aurora";
import { useTheme } from "../lib/theme";

export function Pill({
  label,
  active,
  gradient,
  onPress,
}: {
  label: string;
  active?: boolean;
  gradient?: readonly [string, string];
  onPress?: () => void;
}) {
  const { t: T } = useTheme();
  const inner = (
    <Text style={[Type.label, { color: active ? "#fff" : T.textDim }]} numberOfLines={1}>
      {label}
    </Text>
  );
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={{ borderRadius: Radius.pill, overflow: "hidden" }}
    >
      {active ? (
        <LinearGradient
          colors={gradient ?? T.primarySoft}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pill}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.pill, { backgroundColor: T.surfaceStrong, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: T.hairline }]}>
          {inner}
        </View>
      )}
    </Pressable>
  );
}

export function SectionHeader({ title, accent, action }: { title: string; accent?: string; action?: React.ReactNode }) {
  const { t: T } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: accent ?? T.primary }} />
        <Text style={[Type.h2, { color: T.text }]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function GradientButton({
  label,
  onPress,
  gradient,
  icon,
}: {
  label: string;
  onPress?: () => void;
  gradient?: readonly [string, string];
  icon?: string;
}) {
  const { t: T } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={{ borderRadius: Radius.pill, overflow: "hidden" }}
    >
      <LinearGradient colors={gradient ?? T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        {icon ? <Text style={{ fontSize: 15 }}>{icon}</Text> : null}
        <Text style={[Type.title, { color: "#fff" }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function Loader({ label }: { label?: string }) {
  const { t: T } = useTheme();
  return (
    <View style={{ paddingVertical: 60, alignItems: "center", gap: 12 }}>
      <ActivityIndicator color={T.primary} size="large" />
      {label ? <Text style={[Type.body, { color: T.textFaint }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  const { t: T } = useTheme();
  return (
    <View style={{ paddingVertical: 70, alignItems: "center", gap: 8, paddingHorizontal: 30 }}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text style={[Type.h2, { color: T.text, textAlign: "center" }]}>{title}</Text>
      {sub ? <Text style={[Type.body, { color: T.textFaint, textAlign: "center" }]}>{sub}</Text> : null}
    </View>
  );
}

export function Badge({ text, color, style }: { text: string; color?: string; style?: ViewStyle }) {
  const { t: T } = useTheme();
  const c = color ?? T.primary;
  return (
    <View
      style={[
        { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c },
        style,
      ]}
    >
      <Text style={[Type.micro, { color: "#fff" }]}>{text.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 16, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 14 },
});
