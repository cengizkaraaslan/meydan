import "react-native-reanimated";
import { useEffect, useState } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
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
import { GlobalSignInPrompt } from "@/components/SignInPrompt";
import { onReplayTour } from "@/lib/prefs";
import { initNotifications, scheduleNearbyTeaser, useNearbyNotificationNav } from "@/lib/notify";

// Native splash'ı biz kontrol edelim (yoksa üstte takılı kalabiliyor).
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { user, guest, ready: authReady } = useAuth();
  const { gender, ready: themeReady, t: T, scheme } = useTheme();
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

  // Navigasyon teması paletten (aktif şema: dark/light) türetilir.
  const base = scheme === "light" ? DefaultTheme : DarkTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: T.bg,
      card: T.bg,
      text: T.text,
      primary: T.primary,
      border: T.hairline,
    },
  };

  return (
   <ThemeProvider value={navTheme}>
    <StatusBar style={scheme === "light" ? "dark" : "light"} />
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: T.bg },
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
        <Stack.Screen name="ayarlar" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="ara" options={{ presentation: "transparentModal", animation: "fade" }} />
      </Stack.Protected>

      {/* Google köprüsü dönüşü (meydanfest://auth) — guard'sız. EN SONDA: anchor
          OLMAMALI; ilk koyunca "/" yönlendirmesi döngüye girip boş ekran veriyordu. */}
      <Stack.Screen name="auth" />
    </Stack>
   </ThemeProvider>
  );
}

export default function RootLayout() {
  const [showIntro, setShowIntro] = useState(true);
  const [seenIntro, setSeenIntro] = useState<boolean | null>(null);

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 120);
    AsyncStorage.multiGet(["meydanfest:seenIntro", "meydanfest:reduceMotion"]).then((entries) => {
      const map = Object.fromEntries(entries);
      setSeenIntro(map["meydanfest:seenIntro"] === "1");
      // "Animasyonları azalt" açıksa açılış intro animasyonunu atla.
      if (map["meydanfest:reduceMotion"] === "1") setShowIntro(false);
    });
    return () => clearTimeout(t);
  }, []);

  // Ayarlardan "Tanıtım turunu tekrar göster" → turu hemen yeniden aç.
  useEffect(() => onReplayTour(() => { setShowIntro(false); setSeenIntro(false); }), []);

  const finishWalkthrough = () => {
    setSeenIntro(true);
    AsyncStorage.setItem("meydanfest:seenIntro", "1").catch(() => {});
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Aurora.bg }}>
      <SafeAreaProvider>
        {/* Navigasyon teması + StatusBar artık RootNavigator içinde (aktif şemaya göre). */}
        <I18nProvider>
          <PaletteProvider>
            <AuthProvider>
              <RootNavigator />
              <GlobalSignInPrompt />
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
