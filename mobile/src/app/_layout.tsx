import "react-native-reanimated";
import { useEffect, useState } from "react";
import { DarkTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Aurora } from "@/theme/aurora";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider as PaletteProvider, useTheme } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IntroAnimation } from "@/components/IntroAnimation";
import { Walkthrough } from "@/components/Walkthrough";
import { initNotifications, scheduleNearbyTeaser, useNearbyNotificationNav } from "@/lib/notify";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Aurora.bg,
    card: Aurora.bg,
    text: Aurora.text,
    primary: Aurora.violet,
    border: Aurora.hairline,
  },
};

// Native splash'ı biz kontrol edelim (yoksa üstte takılı kalabiliyor).
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { user, guest, ready: authReady } = useAuth();
  const { gender, ready: themeReady } = useTheme();
  const authed = Boolean(user) || guest;

  // Bildirime dokununca kişi profiline yönlendir.
  useNearbyNotificationNav();

  // Giriş yapıldıysa: izin iste + birazdan "yakındaki kişi" bildirimi planla.
  useEffect(() => {
    if (authed) initNotifications().then(() => scheduleNearbyTeaser());
  }, [authed]);

  // Hazır olana kadar boş (intro animasyonu üstte gösteriliyor).
  if (!authReady || !themeReady) return null;

  // Cinsiyet seçilene kadar giriş ekranı kalır (gender adımı giriş ekranının
  // İÇİNDE gösterilir — sibling overlay native ekranın altında kalıyordu).
  const showAuthFlow = !authed || gender === null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Aurora.bg },
        animation: "fade",
      }}
    >
      <Stack.Protected guard={showAuthFlow}>
        <Stack.Screen name="giris" />
      </Stack.Protected>

      <Stack.Protected guard={!showAuthFlow}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="etkinlik/[id]" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="sohbet/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="kisi/[id]" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="esles" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="olustur" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="ara" options={{ presentation: "transparentModal", animation: "fade" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [showIntro, setShowIntro] = useState(true);
  const [seenIntro, setSeenIntro] = useState<boolean | null>(null);

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 120);
    AsyncStorage.getItem("meydanfest:seenIntro").then((v) => setSeenIntro(v === "1"));
    return () => clearTimeout(t);
  }, []);

  const finishWalkthrough = () => {
    setSeenIntro(true);
    AsyncStorage.setItem("meydanfest:seenIntro", "1").catch(() => {});
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Aurora.bg }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <I18nProvider>
            <PaletteProvider>
              <AuthProvider>
                <RootNavigator />
              </AuthProvider>
            </PaletteProvider>
          </I18nProvider>
          {showIntro && <IntroAnimation onDone={() => setShowIntro(false)} />}
          {/* İlk açılış tanıtım turu (intro'dan sonra, yalnızca ilk kez) */}
          {!showIntro && seenIntro === false && (
            <I18nProvider>
              <PaletteProvider>
                <Walkthrough onDone={finishWalkthrough} />
              </PaletteProvider>
            </I18nProvider>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
