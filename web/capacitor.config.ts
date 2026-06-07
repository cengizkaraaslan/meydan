import type { CapacitorConfig } from "@capacitor/cli";

/**
 * MeydanFest Android wrapper config.
 *
 * Bu app, Next.js sitesini WebView içinde host eder.
 * - Production'da: server URL'i kullanır (Vercel'deki canlı site).
 * - Dev'de: yerel `npm run dev` server'ına bağlanır.
 *
 * APK üretmek için:
 *   npm run cap:build
 *   npx cap open android  # Android Studio açar
 */
const config: CapacitorConfig = {
  appId: "app.meydanfest",
  appName: "MeydanFest",
  webDir: "public", // Capacitor için fallback; gerçek içerik `server.url`'den gelir
  server: {
    // Production canlı URL — değiştirmek için CAPACITOR_SERVER_URL env var kullan
    url:
      process.env.CAPACITOR_SERVER_URL ??
      "https://etkinlikscout.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0f0c1e",
    allowMixedContent: false,
    // Hardware acceleration WebView için
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0f0c1e",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#7c3aed",
    },
  },
};

export default config;
