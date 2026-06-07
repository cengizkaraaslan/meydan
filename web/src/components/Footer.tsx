import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-[var(--muted-bg)]/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-bold text-lg tracking-tight">
            Meydan<span className="text-[var(--primary)]">Fest</span>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)] max-w-sm">{t("tagline")}</p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t("explore")}
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/etkinlikler" className="hover:text-[var(--primary)]">{tNav("events")}</Link></li>
            <li><Link href="/etkinlikler?free=1" className="hover:text-[var(--primary)]">Ücretsiz</Link></li>
            <li><Link href="/sinema" className="hover:text-[var(--primary)]"><span aria-hidden>🎬</span> Sinema</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {t("developers")}
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/api-docs" className="hover:text-[var(--primary)]">API Dokümantasyon</Link></li>
            <li><Link href="/abonelik" className="hover:text-[var(--primary)]">Planlar</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        {t("made_with")} • © 2026 EtkinlikScout
      </div>
    </footer>
  );
}
