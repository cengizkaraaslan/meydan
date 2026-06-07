"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { getMyTicketAction } from "@/lib/ticket-actions";
import { cn } from "@/lib/utils";

export function MyTicketLink({
  slug,
  status,
}: {
  slug: string;
  status: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  if (status !== "GOING") return null;

  function handleClick() {
    setLoading(true);
    startTransition(async () => {
      const res = await getMyTicketAction(slug);
      setLoading(false);
      if (!res.ok || !res.token) {
        toast.error(res.error ?? "Bilet oluşturulamadı");
        return;
      }
      router.push(`/bilet/${res.token}`);
    });
  }

  const busy = loading || isPending;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={cn(
        "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--primary)] transition-colors",
        "hover:bg-[var(--primary)]/15 disabled:opacity-60 disabled:cursor-not-allowed",
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Ticket className="size-4" />
      )}
      <span>{busy ? "Bilet hazırlanıyor…" : "🎟️ Biletini gör"}</span>
    </button>
  );
}
