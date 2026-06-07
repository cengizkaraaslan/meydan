import Link from "next/link";
import { Users, Sparkles, UserPlus } from "lucide-react";
import { MOCK_USERS } from "@/lib/social-data";
import { Avatar } from "@/components/ui/Avatar";
import { RandomBuddyButton } from "@/components/RandomBuddyButton";

export function CommunitySection() {
  const featured = MOCK_USERS.slice(0, 8);
  const interestsByUser: Record<string, string[]> = {
    ahmet: ["Konser", "Festival"],
    elif: ["Tiyatro", "Sergi"],
    burak: ["Jazz", "Stand-up"],
    zeynep: ["Tiyatro", "Çocuk"],
    mert: ["Spor", "Konser"],
    selin: ["Festival", "Atölye"],
    can: ["Konser", "Spor"],
    deniz: ["Sergi", "Tiyatro"],
    naz: ["Festival"],
    ege: ["Konser"],
    yusuf: ["Spor"],
    duru: ["Çocuk", "Atölye"],
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between text-center sm:text-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] px-3 py-1 text-xs font-semibold">
            <Sparkles className="size-3.5" /> Senin ekibin için seçildi
          </div>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
            Bu kişilerle <span className="gradient-text">birlikte git</span>
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)] max-w-xl mx-auto sm:mx-0">
            Aynı kategorilere ilgi duyan kişileri takip et, ortak etkinliklere birlikte gidin.
          </p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <RandomBuddyButton />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {featured.map((u) => {
          const interests = interestsByUser[u.username] ?? ["Konser"];
          return (
            <Link
              key={u.username}
              href={`/profil/${u.username}`}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 hover:shadow-lg hover:border-[var(--primary)]/40 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <Avatar
                  src={u.avatarUrl}
                  name={u.name}
                  color={u.color}
                  size="size-14"
                  className="shadow-md"
                />
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm group-hover:text-[var(--primary)] transition-colors">
                    {u.name}
                  </div>
                  <div className="text-xs text-[var(--muted)] inline-flex items-center gap-1">
                    <Users className="size-3" /> {u.followers.toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[24px]">
                {interests.map((tag) => (
                  <span key={tag} className="rounded-full bg-[var(--muted-bg)] text-[10px] px-2 py-0.5 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] px-3 py-2 text-xs font-semibold group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)] transition-colors">
                <UserPlus className="size-3.5" /> Takip Et
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
