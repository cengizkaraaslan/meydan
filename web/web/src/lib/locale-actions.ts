"use server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { revalidatePath } from "next/cache";

export async function setLocaleCookie(locale: string) {
  if (!isLocale(locale)) return { ok: false as const };
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
