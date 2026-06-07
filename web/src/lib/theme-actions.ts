"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  DEFAULT_THEME,
  resetTheme,
  setTheme,
  THEME_PRESETS,
  type ThemeConfig,
} from "./theme-store";

export async function updateThemeAction(
  patch: Partial<ThemeConfig>,
): Promise<{ ok: boolean; theme?: ThemeConfig; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return { ok: false, error: "Giriş gerekli" };
  }
  // TODO: Faz X — gerçek admin role kontrolü
  const theme = await setTheme(patch, session.user.email ?? undefined);
  revalidatePath("/", "layout");
  return { ok: true, theme };
}

export async function applyPresetAction(
  presetId: string,
): Promise<{ ok: boolean; theme?: ThemeConfig; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user) return { ok: false, error: "Giriş gerekli" };

  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return { ok: false, error: "Preset bulunamadı" };

  const theme = await setTheme(preset.config, session.user.email ?? undefined);
  revalidatePath("/", "layout");
  return { ok: true, theme };
}

export async function resetThemeAction(): Promise<{ ok: boolean; theme: ThemeConfig }> {
  const session = await auth().catch(() => null);
  const theme = await resetTheme(session?.user?.email ?? undefined);
  revalidatePath("/", "layout");
  return { ok: true, theme };
}

export { DEFAULT_THEME };
