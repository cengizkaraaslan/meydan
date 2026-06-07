import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";
import { NotificationOptInBanner } from "@/components/NotificationOptInBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LocationOnboardingPrompt } from "@/components/LocationOnboardingPrompt";
import { FloatingChatBubble } from "@/components/FloatingChatBubble";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { TopLoader } from "@/components/TopLoader";
import { RTL_LOCALES, type Locale } from "@/i18n/config";
import { getTheme, buildThemeCss } from "@/lib/theme-store";
import { siteUrl, SITE_NAME } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "MeydanFest — Plan senden, kalabalık bizden",
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "Türkiye'nin etkinlik arkadaşı ağı. Konser, festival, tiyatro, spor ve ücretsiz belediye etkinlikleri — keşfet, ekibini topla, birlikte git.",
  manifest: "/manifest.json",
  applicationName: "MeydanFest",
  appleWebApp: {
    capable: true,
    title: "MeydanFest",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "MeydanFest",
    description: "Plan senden, kalabalık bizden. En iyi etkinlik, doğru kişilerle.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
  const theme = await getTheme();
  const themeCss = buildThemeCss(theme);

  return (
    <html lang={locale} dir={dir} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <style id="meydanfest-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Suspense fallback={null}>
            <TopLoader />
          </Suspense>
          <Header />
          <main className="flex-1 pb-20 lg:pb-0">{children}</main>
          <Footer />
          <BottomNav />
          <NotificationOptInBanner />
          <InstallPrompt />
          <LocationOnboardingPrompt />
          <FloatingChatBubble />
          <ServiceWorkerRegister />
          <Toaster position="top-center" theme="system" closeButton richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
