"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical, Ban, Flag, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { blockUser, unblockUser, reportUser } from "@/lib/safety-actions";

const LS_KEY = "es.blocks";

function readBlocks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeBlocks(set: Set<string>) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch {}
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "taciz", label: "Taciz" },
  { value: "yaniltici", label: "Yanıltıcı içerik" },
  { value: "diger", label: "Diğer" },
];

interface BlockReportMenuProps {
  username: string;
  displayName: string;
  onBlockChange?: (blocked: boolean) => void;
}

export function BlockReportMenu({ username, displayName, onBlockChange }: BlockReportMenuProps) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBlocked(readBlocks().has(username));
  }, [username]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggleBlock() {
    setOpen(false);
    const set = readBlocks();
    if (set.has(username)) {
      set.delete(username);
      writeBlocks(set);
      setBlocked(false);
      onBlockChange?.(false);
      try {
        await unblockUser(username);
      } catch {}
      toast.success(`${displayName} engeli kaldırıldı`);
    } else {
      set.add(username);
      writeBlocks(set);
      setBlocked(true);
      onBlockChange?.(true);
      try {
        await blockUser(username);
      } catch {}
      toast.success(`${displayName} engellendi`);
    }
  }

  function openReport() {
    setOpen(false);
    setReason(REPORT_REASONS[0].value);
    setDetails("");
    setReportOpen(true);
  }

  async function submitReport() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await reportUser(username, reason, details);
      toast.success("Bildirimin alındı, inceleyeceğiz");
      setReportOpen(false);
    } catch {
      toast.error("Bildirim gönderilemedi, tekrar deneyin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Daha fazla"
          className="inline-flex items-center justify-center size-9 rounded-full hover:bg-[var(--muted-bg)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <MoreVertical className="size-5" />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute end-0 top-full mt-1 z-50 w-48 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={toggleBlock}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-[var(--muted-bg)] transition-colors text-start"
              >
                {blocked ? (
                  <>
                    <ShieldOff className="size-4 text-[var(--success)]" />
                    <span>Engeli kaldır</span>
                  </>
                ) : (
                  <>
                    <Ban className="size-4 text-[var(--danger)]" />
                    <span>Engelle</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={openReport}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-[var(--muted-bg)] transition-colors text-start border-t border-[var(--border)]"
              >
                <Flag className="size-4 text-[var(--accent)]" />
                <span>Bildir</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setReportOpen(false)}
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
                  <h3 className="font-semibold text-base">Kullanıcıyı bildir</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">@{username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
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
                    {REPORT_REASONS.map((r) => (
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
                  <label htmlFor="report-details" className="block text-sm font-medium mb-2">
                    Açıklama <span className="text-[var(--muted)] font-normal">(isteğe bağlı)</span>
                  </label>
                  <textarea
                    id="report-details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Detay vermek istersen yaz..."
                    className="w-full resize-none rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
                  />
                  <div className="mt-1 text-end text-[10px] text-[var(--muted)]">
                    {details.length}/500
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--muted-bg)]/40">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-full px-4 py-1.5 text-sm hover:bg-[var(--muted-bg)] transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={submitReport}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)] text-white px-4 py-1.5 text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  <Flag className="size-3.5" />
                  {submitting ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
