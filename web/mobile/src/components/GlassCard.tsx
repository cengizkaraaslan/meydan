import React from "react";
import { StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { Radius } from "../theme/aurora";
import { useTheme } from "../lib/theme";

interface GlassCardProps extends ViewProps {
  intensity?: number;
  radius?: number;
  padded?: boolean;
  glowColor?: string;
}

/** Cam/blur yüzey — glassmorphism. */
export function GlassCard({
  children,
  intensity = 26,
  radius = Radius.lg,
  padded = true,
  glowColor,
  style,
  ...rest
}: GlassCardProps) {
  const { t: T } = useTheme();
  const glow: ViewStyle = glowColor
    ? { shadowColor: glowColor, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 14 }
    : {};
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, glow, style]} {...rest}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: T.surface, borderRadius: radius, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: T.hairline },
        ]}
      />
      <View style={padded ? { padding: 16 } : undefined}>{children}</View>
    </View>
  );
}
