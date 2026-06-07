"use client";

import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { Check, Star, Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setMovieRsvpAction } from "@/lib/rsvp-actions";
import { useClientSession } from "@/lib/use-session";
import { LoginRequiredModal } from "./LoginRequiredModal";
import type { AttendanceStatus } from "@/lib/types";

export function MovieRsvpButtons({
  slug,
  initial,
}: {
  /** movieSlug (without `movie:` prefix). Action namespaces internally. */
  slug: string;
  initial?: AttendanceStatus | null;
}) {
  const [status, setStatus] = useState<AttendanceStatus | null>(initial ?? null);
  const [showLogin, setShowLogin] = useState(false);
  const [, startTransition] = useTransition();
  const { isLoggedIn, loading } = useClientSession();

  function pick(next: AttendanceStatus) {
    if (!loading && !isLoggedIn) {
      setShowLogin(true);
      return;
    }
    const newStatus = status === next ? null : next;
    const prev = status;
    setStatus(newStatus);
    startTransition(async () => {
      const res = await setMovieRsvpAction(slug, newStatus);
      if (!res.ok) {
        setStatus(prev);
        if (res.error === "unauthenticated") {
          setShowLogin(true);
        } else if (res.error === "event_not_found") {
          toast.error("Film bulunamadı.");
        } else {
          toast.error("Bir şeyler ters gitti.");
        }
        return;
      }
      const msg =
        newStatus === "GOING" ? "Bu filme gidiyorsun 🎬" :
        newStatus === "MAYBE" ? "Belki olarak işaretlendi" :
        newStatus === "INTERESTED" ? "İlgileniyorsun" :
        "Geri alındı";
      toast.success(msg);
    });
  }

  const options: { value: AttendanceStatus; label: string; icon: typeof Check }[] = [
    { value: "GOING",      label: "Katılacağım",   icon: Check },
    { value: "MAYBE",      label: "Belki",          icon: Heart },
    { value: "INTERESTED", label: "İlgileniyorum", icon: Star },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ value, label, icon: Icon }) => {
          const active = status === value;
          return (
            <motion.button
              key={value}
              type="button"
              onClick={() => pick(value)}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={cn(
                "relative inline-flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] hover:bg-[var(--muted-bg)]",
              )}
            >
              <Icon className={cn("size-5 transition-transform", active && "scale-110")} />
              <span className="text-xs">{label}</span>
            </motion.button>
          );
        })}
      </div>
      <LoginRequiredModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        title="Filme katılım için giriş gerekli"
        description="Sinemaya birlikte gidecek arkadaş bulmak ve hatırlatıcılar almak için MeydanFest hesabına ihtiyacın var."
      />
    </>
  );
}
