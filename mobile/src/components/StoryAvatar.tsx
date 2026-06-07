import React from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/theme";

/** Instagram-tarzı story halkası renkleri (web StoryRing ile aynı paleti yaklaşıklar). */
const STORY_COLORS = ["#F59E0B", "#EC4899", "#7C3AED", "#06B6D4"] as const;

interface Props {
  uri?: string | null;
  name?: string;
  size: number;
  /** Aktif story varsa renkli halka. */
  hasStory?: boolean;
  /** Sağ-alt çevrimiçi noktası. */
  online?: boolean;
  onPress?: () => void;
}

/**
 * Story halkalı yuvarlak avatar — etkinlik katılımcıları, yakındakiler, eşleşme gibi
 * listelerde kullanılır. `hasStory` ise Instagram benzeri gradient halka çizer.
 */
export function StoryAvatar({ uri, name, size, hasStory, online, onPress }: Props) {
  const { t: T } = useTheme();
  const STROKE = Math.max(2, Math.round(size * 0.07));
  const GAP = 2;
  const outer = size + 2 * (STROKE + GAP);
  const innerBg = size + 2 * GAP;

  const avatar = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />
  ) : (
    <LinearGradient
      colors={T.primaryGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.4 }}>
        {(name?.trim()?.charAt(0) ?? "✦").toUpperCase()}
      </Text>
    </LinearGradient>
  );

  const innerCircle = (
    <View
      style={{
        width: innerBg,
        height: innerBg,
        borderRadius: innerBg / 2,
        padding: GAP,
        backgroundColor: T.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {avatar}
    </View>
  );

  const ring = hasStory ? (
    <LinearGradient
      colors={STORY_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: outer, height: outer, borderRadius: outer / 2, padding: STROKE, alignItems: "center", justifyContent: "center" }}
    >
      {innerCircle}
    </LinearGradient>
  ) : (
    // Story yoksa: aynı boyut, nötr ince çerçeve (hizalama bozulmasın).
    <View
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        padding: STROKE,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: T.hairline,
      }}
    >
      {innerCircle}
    </View>
  );

  const body = (
    <View style={{ width: outer, height: outer }}>
      {ring}
      {online ? (
        <View
          style={{
            position: "absolute",
            right: STROKE,
            bottom: STROKE,
            width: Math.round(size * 0.26),
            height: Math.round(size * 0.26),
            borderRadius: Math.round(size * 0.13),
            backgroundColor: T.success,
            borderWidth: 2,
            borderColor: T.bg,
          }}
        />
      ) : null}
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
