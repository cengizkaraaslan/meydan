import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { BottomNavClient } from "./BottomNavClient";

export async function BottomNav() {
  const t = await getTranslations("nav");
  const session = await auth().catch(() => null);
  const isLoggedIn = !!session?.user;
  // Profil item'i giris durumuna gore yonlenir
  const profileHref = isLoggedIn ? "/ayarlar/profil" : "/giris";
  const profileLabel = isLoggedIn ? t("profile") : t("login");

  const items = [
    { href: "/",            iconName: "Home"          as const, label: t("home"),   primary: false },
    { href: "/etkinlikler", iconName: "CalendarDays"  as const, label: t("events"), primary: false },
    { href: "/yayinla",     iconName: "Plus"          as const, label: "Aç",        primary: true  },
    { href: "/yakinimda",   iconName: "MapPin"        as const, label: "Yakınımda", primary: false },
    { href: profileHref,    iconName: "User"          as const, label: profileLabel, primary: false },
  ];
  return <BottomNavClient items={items} isLoggedIn={isLoggedIn} />;
}
