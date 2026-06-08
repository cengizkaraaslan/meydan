import React, { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";

interface Props {
  posterUrl: string;
  backdropUrl?: string;
  title: string;
  /** Dış kapsayıcı stili (boyut/border/radius dışarıdan verilir). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Sağlam poster bileşeni — "resmi yok" sorununu her yerde çözer.
 * Zincir: posterUrl → (onError) backdropUrl → (onError) tema gradient placeholder
 * (🎬 + film adı). expo-image onError ile aşama aşama geriye düşer.
 */
export function MoviePoster({ posterUrl, backdropUrl, title, style }: Props) {
  const { t: T } = useTheme();
  // 0: poster, 1: backdrop, 2: placeholder
  const [stage, setStage] = useState(0);

  // Bir sonraki kaynağa düş; backdrop yoksa direkt placeholder'a atla.
  const fail = () => setStage((s) => (s === 0 && backdropUrl ? 1 : 2));

  const uri = stage === 0 ? posterUrl : backdropUrl;

  if (stage >= 2 || !uri) {
    return (
      <View style={[styles.fill, style, { overflow: "hidden" }]}>
        <LinearGradient
          colors={T.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.center]}
        >
          <Text style={{ fontSize: 30 }}>🎬</Text>
          <Text
            style={[Type.label, { color: T.text, marginTop: 6, textAlign: "center", paddingHorizontal: 6 }]}
            numberOfLines={3}
          >
            {title}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[style, { overflow: "hidden" }]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
        onError={fail}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
});
