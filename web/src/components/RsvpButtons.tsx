"use client";

import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { Check, Star, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setRsvpAction } from "@/lib/rsvp-actions";
import { MyTicketLink } from "@/components/MyTicketLink";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { playClick } from "@/lib/sounds";
import type { AttendanceStatus } from "@/lib/types";

interface RsvpButtonsProps {
  slug: string;
  initial?: AttendanceStatus | null;
  isLoggedIn?: boolean;
  /** Ücretsiz kurs vb. için bilet linkini gizle (belediye kursunda "biletini al" olmaz). */
  showTicket?: boolean;
}

export function RsvpButtons({ slug, initial, isLoggedIn = false, showTicket = true }: RsvpButtonsProps) {
  const t = useTranslations("event");
  const [status, setStatus] = useState<AttendanceStatus | null>(initial ?? null);
  const [showLogin, setShowLogin] = useState(false);
  const [, startTransition] = useTransition();

  function pick(next: AttendanceStatus) {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    const newStatus = status === next ? null : next;
    const prev = status;
    setStatus(newStatus);
    playClick();
    startTransition(async () => {
      const res = await setRsvpAction(slug, newStatus);
      if (!res.ok) {
        setStatus(prev);
        if (res.error === "unauthenticated") {
          setShowLogin(true);
        } else if (res.error === "event_not_found") {
          toast.error("Etkinlik bulunamadı.");
        } else {
          toast.error("Bir şeyler ters gitti.");
        }
        return;
      }
      toast.success(
        newStatus ? t(`rsvp_${newStatus.toLowerCase()}` as never) : "Geri alındı",
      );
    });
  }

  const options: { value: AttendanceStatus; label: string; icon: typeof Check }[] = [
    { value: "GOING", label: t("rsvp_going"), icon: Check },
    { value: "MAYBE", label: t("rsvp_maybe"), icon: Heart },
    { value: "INTERESTED", label: t("rsvp_interested"), icon: Star },
  ];

  return (
    <div>
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
      {showTicket && <MyTicketLink slug={slug} status={status} />}
      <LoginRequiredModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        title="Katılım için giriş gerekli"
        description="Etkinliğe katılım, hatırlatıcılar ve buddy eşleşmesi için MeydanFest hesabına ihtiyacın var."
      />
    </div>
  );
}
