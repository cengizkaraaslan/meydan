import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Radius, Type, glow } from "@/theme/aurora";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

interface TabRoute { key: string; name: string }
interface TabBarProps {
  state: { index: number; routes: TabRoute[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const TABS: Record<string, { labelKey: string; icon: IoniconName }> = {
  index: { labelKey: "tab_discover", icon: "compass" },
  kategoriler: { labelKey: "tab_categories", icon: "grid" },
  yakinimda: { labelKey: "tab_nearby", icon: "location" },
  takvim: { labelKey: "tab_calendar", icon: "calendar" },
  favoriler: { labelKey: "tab_favorites", icon: "heart" },
  profil: { labelKey: "tab_profile", icon: "person" },
};

function AuroraTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { t: T } = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  // Oturum yoksa (misafir/girişsiz) favori sekmesini bar'dan gizle; ekran kayıtlı kalır.
  const routes = state.routes.filter((r) => !(r.name === "favoriler" && !user));
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom ? insets.bottom : 14 }]} pointerEvents="box-none">
      <View style={[styles.bar, glow(T.primary, 22, 0.4)]}>
        <BlurView intensity={40} tint={T.scheme === "light" ? "light" : "dark"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.scheme === "light" ? "rgba(255,255,255,0.6)" : "rgba(15,13,24,0.55)", borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: T.hairline }]} />
        {routes.map((route) => {
          const meta = TABS[route.name] ?? { labelKey: route.name, icon: "•" as IoniconName };
          const focused = state.routes[state.index]?.key === route.key;
          return (
            <Pressable
              key={route.key}
              style={styles.item}
              onPress={() => {
                Haptics.selectionAsync();
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              {focused ? (
                <LinearGradient colors={T.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activeIcon}>
                  <Ionicons name={meta.icon} size={20} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.idleIcon}>
                  <Ionicons name={meta.icon} size={20} color={T.textFaint} />
                </View>
              )}
              <Text numberOfLines={1} style={[Type.micro, { color: focused ? T.text : T.textFaint, fontSize: 9.5, maxWidth: 56, textAlign: "center" }]}>{t(meta.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }} tabBar={(p) => <AuroraTabBar {...p} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="kategoriler" />
      <Tabs.Screen name="yakinimda" />
      <Tabs.Screen name="takvim" />
      <Tabs.Screen name="favoriler" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: "center" },
  bar: { flexDirection: "row", borderRadius: Radius.xl, overflow: "hidden", paddingVertical: 14, paddingHorizontal: 8, width: "100%" },
  item: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 2 },
  activeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  idleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
