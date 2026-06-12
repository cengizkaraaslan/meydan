"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitReportAction } from "@/lib/reports-actions";

type ReportTarget = "comment" | "user" | "event";
type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "inappropriate"
  | "scam"
  | "other";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Taciz" },
  { value: "hate", label: "Nefret" },
  { value: "inappropriate", label: "Uygunsuz" },
  { value: "scam", label: "Dolandırıcılık" },
  { value: "other", label: "Diğer" },
];

interface ReportButtonProps {
  target: ReportTarget;
  targetId: string;
  targetExcerpt: string;
  targetContext?: string;
  isLoggedIn?: boolean;
  label?: string;
  variant?: "icon" | "text";
}

export function ReportButton({
  target,
  targetId,
  targetExcerpt,
  targetContext,
  isLoggedIn = true,
  label = "Bildir",
  variant = "text",
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href="/giris"
        title="Bildirmek için giriş yap"
        className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <Flag className="size-3.5" />
        {variant === "text" && label}
      </Link>
    );
  }

  function submit() {
    // Optimistic: raporu kabul edilmiş gibi modalı anında kapat + teşekkür et;
    // gönderim arkada sürer, yalnız gerçekten başarısızsa hata göster.
    const payload = { target, targetId, targetExcerpt, targetContext, reason, note };
    toast.success("Raporun alındı, ekibimiz inceleyecek");
    setOpen(false);
    setNote("");
    setReason("spam");
    startTransition(async () => {
      const res = await submitReportAction(payload);
      if (!res.ok) {
        toast.error(res.error ?? "Rapor gönderilemedi, tekrar dener misin?");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <Flag className="size-3.5" />
        {variant === "text" && label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 8, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <h3 className="font-semibold text-base">İçeriği bildir</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {target === "comment" && "Yorum"}
                    {target === "user" && "Kullanıcı"}
                    {target === "event" && "Etkinlik"}
                    {" · "}
                    {targetExcerpt.slice(0, 60)}
                    {targetExcerpt.length > 60 ? "…" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Kapat"
                  className="rounded-full size-8 inline-flex items-center justify-center hover:bg-[var(--muted-bg)] transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Sebep</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm transition-colors text-start",
                          reason === r.value
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                            : "border-[var(--border)] hover:bg-[var(--muted-bg)]",
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="report-note" className="block text-sm font-medium mb-2">
                    Açıklama{" "}
                    <span className="text-[var(--muted)] font-normal">(isteğe bağlı)</span>
                  </label>
                  <textarea
                    id="report-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Detay vermek istersen yaz..."
                    className="w-full resize-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
                  />
                  <div className="mt-1 text-end text-[10px] text-[var(--muted)]">
                    {note.length}/500
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--muted-bg)]/40">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-4 py-1.5 text-sm hover:bg-[var(--muted-bg)] transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)] text-white px-4 py-1.5 text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  <Flag className="size-3.5" />
                  {pending ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
