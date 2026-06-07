import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Sparkles, User } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MoreMenu } from "./MoreMenu";
import { SmartSearch } from "./SmartSearch";
import { NotificationBell } from "./NotificationBell";
import { UserDropdown } from "./UserDropdown";
import { auth } from "@/auth";

export async function Header() {
  const t = await getTranslations("nav");
  const session = await auth().catch(() => null);
  const user = session?.user;
  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-md transition-transform group-hover:rotate-3">
              <Sparkles className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              Meydan<span className="text-[var(--primary)]">Fest</span>
            </span>
          </Link>

          {/* AI destekli akıllı arama — Türkçe doğal dil sorgusunu filtreye çevirir */}
          <SmartSearch />

          <div className="flex items-center gap-1.5">
            {user && <NotificationBell />}
            <MoreMenu />
            <LanguageSwitcher />
            {user ? (
              <UserDropdown
                name={user.name ?? null}
                image={user.image ?? null}
                email={user.email ?? null}
              />
            ) : (
              <Link
                href="/giris"
                aria-label={t("login")}
                title={t("login")}
                className="grid place-items-center rounded-full border border-[var(--border)] size-9 hover:bg-[var(--muted-bg)] hover:border-[var(--primary)]/40 transition-colors"
              >
                <User className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
