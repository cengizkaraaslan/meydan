import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Radius, Type } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import type { MentionUser } from "@/lib/mentions";

/**
 * @mention autocomplete açılır listesi. Input'un hemen ÜSTÜNE konur (normal akış).
 * Boşken hiçbir şey çizmez. Seçince onPick(email) çağrılır.
 */
export function MentionSuggestions({
  users,
  onPick,
}: {
  users: MentionUser[];
  onPick: (email: string) => void;
}) {
  const { t: T } = useTheme();
  if (users.length === 0) return null;
  return (
    <View style={[styles.box, { backgroundColor: T.surfaceStrong, borderColor: T.hairline }]}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 196 }}>
        {users.map((u) => (
          <Pressable key={u.email} onPress={() => onPick(u.email)} style={styles.row}>
            {u.avatar ? (
              <Image source={{ uri: u.avatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: T.surface }]}>
                <Text style={{ fontSize: 14 }}>🙂</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[Type.label, { color: T.text }]} numberOfLines={1}>
                {u.name || u.email}
              </Text>
              <Text style={[Type.micro, { color: T.textFaint }]} numberOfLines={1}>
                {u.email}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginBottom: 8,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
});
