import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, Cable, CreditCard, ScrollText, HardDrive, Flag, Palette } from "lucide-react";
import { getOpenCount } from "@/lib/reports-store";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/adminAuth";

const nav = [
  { href: "/admin",                label: "Panel",        icon: LayoutDashboard },
  { href: "/admin/etkinlikler",    label: "Etkinlikler",  icon: CalendarDays },
  { href: "/admin/kullanicilar",   label: "Kullanıcılar", icon: Users },
  { href: "/admin/raporlar",       label: "Raporlar",     icon: Flag, badge: "reports" as const },
  { href: "/admin/scrapers",       label: "Scrapers",     icon: Cable },
  { href: "/admin/abonelikler",    label: "Abonelikler",  icon: CreditCard },
  { href: "/admin/depolama",       label: "Depolama",     icon: HardDrive },
  { href: "/admin/tema",           label: "Tema",         icon: Palette },
  { href: "/admin/loglar",         label: "Loglar",       icon: ScrollText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guard: yalnızca admin (kurucu e-posta VEYA DB role=ADMIN) paneli görebilir.
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  if (!email) redirect("/giris");
  if (!(await isAdminEmail(email))) redirect("/");

  const openReports = getOpenCount();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--muted)]">MeydanFest</div>
          <h1 className="text-3xl font-bold tracking-tight">Yönetim Paneli</h1>
        </div>
        <span className="rounded-full bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/30 px-3 py-1 text-xs font-medium">
          ADMIN MOCK
        </span>
      </div>
      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <nav className="space-y-1 self-start lg:sticky lg:top-24">
          {nav.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm hover:bg-[var(--muted-bg)] transition-colors"
            >
              <Icon className="size-4 text-[var(--muted)]" />
              <span className="flex-1">{label}</span>
              {badge === "reports" && openReports > 0 && (
                <span className="rounded-full bg-[var(--danger)] text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                  {openReports}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <section>{children}</section>
      </div>
    </div>
  );
}
