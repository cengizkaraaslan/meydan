import Link from "next/link";
import { User, Bell, Shield, ChevronRight } from "lucide-react";

const SECTIONS = [
  { href: "/ayarlar/profil",       icon: User,   title: "Profil",       desc: "Avatar, isim, biyografi, Instagram",     color: "from-violet-500 to-purple-500" },
  { href: "/ayarlar/bildirimler", icon: Bell,   title: "Bildirimler",  desc: "Push bildirim, kategori tercihleri",     color: "from-amber-500 to-orange-500" },
  { href: "/gizlilik",             icon: Shield, title: "Gizlilik",     desc: "Veri kullanımı ve gizlilik politikası",  color: "from-rose-500 to-red-500" },
];

export default function AyarlarPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Ayarlar</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Hesabını ve tercihlerini yönet.</p>
      </header>

      <div className="space-y-2.5">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 hover:border-[var(--primary)]/40 hover:shadow-md transition-all"
          >
            <span className={`grid place-items-center size-12 rounded-2xl bg-gradient-to-br ${s.color} text-white shrink-0 shadow-md`}>
              <s.icon className="size-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold group-hover:text-[var(--primary)] transition-colors">{s.title}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">{s.desc}</div>
            </div>
            <ChevronRight className="size-5 text-[var(--muted)] shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
