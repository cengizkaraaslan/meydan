import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuroraBackground } from "@/components/AuroraBackground";
import { EventRow } from "@/components/EventCard";
import { EmptyState, GradientButton } from "@/ui/atoms";
import { Type } from "@/theme/aurora";
import { useFavorites } from "@/lib/favorites";
import type { ApiEvent } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { list } = useFavorites();

  return (
    <View style={[styles.root, { backgroundColor: T.bg }]}>
      <AuroraBackground />

      {list.length === 0 ? (
        <View style={[styles.emptyWrap, { paddingTop: insets.top + 8 }]}>
          <Header count={0} />
          <EmptyState
            emoji="🤍"
            title={t("no_fav")}
            sub={t("no_fav_sub")}
          />
          <View style={styles.cta}>
            <GradientButton
              label={t("explore_events")}
              icon="✦"
              onPress={() => router.navigate("/")}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(e: ApiEvent) => e.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(420)}>
              <EventRow event={item} />
            </Animated.View>
          )}
          ListHeaderComponent={<Header count={list.length} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingBottom: 130,
            paddingHorizontal: 16,
          }}
        />
      )}
    </View>
  );
}

function Header({ count }: { count: number }) {
  const { t: T } = useTheme();
  const { t } = useT();
  return (
    <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
      <Text style={[Type.h1, { color: T.text }]}>{t("my_favorites")}</Text>
      <Text style={[Type.label, { color: T.textFaint, marginTop: 4 }]}>
        {t("fav_count", { count })}
      </Text>
      <View style={[styles.hairline, { backgroundColor: T.hairline }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyWrap: { flex: 1, paddingHorizontal: 16 },
  header: { marginBottom: 16 },
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  cta: { alignItems: "center", marginTop: 4 },
});
