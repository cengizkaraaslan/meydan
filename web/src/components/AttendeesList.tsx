import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { avatarUrlFor } from "@/lib/social-data";
import { Avatar } from "@/components/ui/Avatar";

const MOCK_ATTENDEES = [
  { username: "ahmet", name: "Ahmet K.", color: "#7c3aed" },
  { username: "elif", name: "Elif S.", color: "#f59e0b" },
  { username: "burak", name: "Burak D.", color: "#10b981" },
  { username: "zeynep", name: "Zeynep T.", color: "#ef4444" },
  { username: "mert", name: "Mert Y.", color: "#06b6d4" },
  { username: "selin", name: "Selin A.", color: "#ec4899" },
  { username: "can", name: "Can B.", color: "#8b5cf6" },
  { username: "deniz", name: "Deniz M.", color: "#14b8a6" },
].map((a) => ({ ...a, avatarUrl: avatarUrlFor(a.name) }));

export async function AttendeesList({ count = 248 }: { count?: number }) {
  const t = await getTranslations("event");
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t("attendees_title")}</h3>
        <span className="text-sm text-[var(--muted)]">{count}</span>
      </div>
      <ul className="space-y-2.5">
        {MOCK_ATTENDEES.map((a) => (
          <li key={a.username}>
            <Link
              href={`/profil/${a.username}`}
              className="flex items-center gap-3 rounded-xl p-2 -mx-2 hover:bg-[var(--muted-bg)] transition-colors"
            >
              <Avatar
                src={a.avatarUrl}
                name={a.name}
                color={a.color}
                size="size-9"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-xs text-[var(--muted)]">@{a.username}</div>
              </div>
            </Link>
          </li>
        ))}
        {count > MOCK_ATTENDEES.length && (
          <li className="text-center text-xs text-[var(--muted)] pt-2">
            +{count - MOCK_ATTENDEES.length} kişi daha
          </li>
        )}
      </ul>
    </section>
  );
}
