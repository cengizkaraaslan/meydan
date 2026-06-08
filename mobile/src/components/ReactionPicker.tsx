import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Radius, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { impactH } from "@/lib/haptics";
import { REACTIONS } from "@/lib/social";

interface Props {
  /** Şu anki tepkim (varsa highlight + tekrar seçince kaldır). */
  myReaction: string | null;
  onPick: (emoji: string) => void;
}

/** Facebook-tarzı yatay tepki seçici popup (üstte küçük balon). */
export function ReactionPicker({ myReaction, onPick }: Props) {
  const { t: T } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      style={[
        styles.bubble,
        { backgroundColor: T.bgElevated, borderColor: T.hairline },
        glow(T.primary, 16, 0.35),
      ]}
    >
      {REACTIONS.map((emoji, i) => {
        const mine = myReaction === emoji;
        return (
          <Animated.View key={emoji} entering={ZoomIn.delay(i * 28).duration(220)}>
            <Pressable
              onPress={() => { impactH(); onPick(emoji); }}
              hitSlop={6}
              style={[
                styles.item,
                mine ? { backgroundColor: T.surfaceStrong, borderColor: T.primary } : undefined,
              ]}
            >
              <Animated.Text entering={FadeIn} style={styles.emoji}>{emoji}</Animated.Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  item: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "transparent",
  },
  emoji: { fontSize: 26 },
});
