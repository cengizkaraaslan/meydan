import type { Metadata } from "next";
import { NotificationSettingsClient } from "@/components/NotificationSettingsClient";

export const metadata: Metadata = {
  title: "Bildirim Tercihlerin — EtkinlikScout",
  description: "Hangi kategorilerde bildirim almak istediğini seç.",
};

export default function NotificationSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bildirim Tercihlerin</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Seçtiğin kategorilerde yeni etkinlik eklendiğinde anında haberin olsun.
        </p>
      </header>

      <NotificationSettingsClient />
    </div>
  );
}
