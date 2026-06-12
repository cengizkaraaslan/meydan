import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { tapH } from "@/lib/haptics";

interface Props {
  /** Yanıtlanan yorumun yazarı. */
  authorName: string;
  /** Yanıtlanan yorumun kısa özeti. */
  snippet: string;
  onCancel: () => void;
}

/** Yorum yazarken aktif alıntıyı gösteren bar (sohbetteki reply bar deseni). Input'un üstüne. */
export function ReplyComposerBar({ authorName, snippet, onCancel }: Props) {
  const { t: T } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      exiting={FadeOutDown.duration(120)}
      style={[styles.bar, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}
    >
      <View style={[styles.accent, { backgroundColor: T.primary }]} />
      <View style={{ flex: 1 }}>
        <Text style={[Type.micro, { color: T.primary, fontWeight: "700" }]} numberOfLines={1}>
          {authorName}'e yanıt veriyorsun
        </Text>
        <Text style={[Type.micro, { color: T.textDim }]} numberOfLines={1}>
          {snippet}
        </Text>
      </View>
      <Pressable onPress={() => { tapH(); onCancel(); }} hitSlop={10}>
        <Text style={{ fontSize: 18, color: T.textDim }}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: 8,
  },
  accent: { width: 3, alignSelf: "stretch", borderRadius: 2 },
});
