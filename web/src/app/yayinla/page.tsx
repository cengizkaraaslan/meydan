import Link from "next/link";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { EventCreateForm } from "@/components/EventCreateForm";

export const metadata = {
  title: "Etkinliğini Yayınla — MeydanFest",
  description: "MeydanFest'te kendi etkinliğini ücretsiz yayınla. Topluluğun keşfetsin.",
};

export default function PublishEventPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
            <Sparkles className="size-3.5 text-[var(--accent)]" />
            Organizatör paneli
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Etkinliğini Yayınla
          </h1>
          <p className="text-sm text-[var(--muted)] max-w-xl">
            MeydanFest&apos;te kendi etkinliğini ücretsiz yayınla. Topluluğun keşfetsin.
          </p>
        </div>

        <Link
          href="/yayinla/yonetim"
          className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
        >
          <LayoutDashboard className="size-4" />
          Etkinliklerim
        </Link>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
        <EventCreateForm />
      </div>
    </div>
  );
}
