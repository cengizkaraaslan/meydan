/**
 * MeydanFest — "Aurora" tasarım sistemi.
 * Derin koyu zemin + sinematik mor-mavi-pembe gradient + cam (blur) katmanlar.
 */
import { Platform } from "react-native";

export const Aurora = {
  // Zemin katmanları (koyudan açığa)
  bg: "#08070D",
  bgElevated: "#0F0D18",
  surface: "rgba(255,255,255,0.04)",
  surfaceStrong: "rgba(255,255,255,0.08)",
  hairline: "rgba(255,255,255,0.10)",

  // Metin
  text: "#F5F3FF",
  textDim: "#B9B4D0",
  textFaint: "#6E6890",

  // Neon vurgular
  violet: "#A855F7",
  indigo: "#6366F1",
  blue: "#3B82F6",
  pink: "#EC4899",
  cyan: "#22D3EE",
  gold: "#F5C24B",
  success: "#34D399",

  // Gradientler (LinearGradient için)
  auroraGlow: ["#7C3AED", "#3B82F6", "#EC4899"] as const,
  violetBlue: ["#8B5CF6", "#3B82F6"] as const,
  pinkViolet: ["#EC4899", "#A855F7"] as const,
  cyanBlue: ["#22D3EE", "#3B82F6"] as const,
  goldWarm: ["#F5C24B", "#F59E0B"] as const,
  cardFade: ["transparent", "rgba(8,7,13,0.0)", "rgba(8,7,13,0.92)"] as const,
} as const;

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 } as const;

export const Radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const Font = Platform.select({
  ios: { display: "System", body: "System" },
  default: { display: "sans-serif-medium", body: "sans-serif" },
})!;

export const Type = {
  hero: { fontSize: 34, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -0.5 },
  h1: { fontSize: 26, lineHeight: 30, fontWeight: "800" as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, lineHeight: 24, fontWeight: "700" as const, letterSpacing: -0.2 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "700" as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "500" as const },
  label: { fontSize: 12, lineHeight: 15, fontWeight: "600" as const, letterSpacing: 0.3 },
  micro: { fontSize: 10.5, lineHeight: 13, fontWeight: "700" as const, letterSpacing: 0.6 },
} as const;

// Yumuşak gölge (premium derinlik)
export const glow = (color: string, radius = 18, opacity = 0.5) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
});
