"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { resolveReportAction } from "@/lib/reports-actions";

interface ReportActionsProps {
  reportId: string;
  canBan: boolean;
}

export function ReportActions({ reportId, canBan }: ReportActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: "dismiss" | "hide" | "ban") {
    if (!confirm(actionConfirm(action))) return;
    startTransition(async () => {
      const res = await resolveReportAction(reportId, action);
      if (!res.ok) {
        toast.error(res.error ?? "İşlem başarısız");
        return;
      }
      toast.success(actionSuccess(action));
      router.refresh();
    });
  }

  return (
    <div className="grid sm:grid-cols-3 gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("dismiss")}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-50"
      >
        <X className="size-4 text-[var(--muted)]" /> Reddet
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("hide")}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
      >
        <EyeOff className="size-4" /> İçeriği Gizle
      </button>
      <button
        type="button"
        disabled={pending || !canBan}
        onClick={() => run("ban")}
        title={canBan ? "Kullanıcıyı banla" : "Sadece kullanıcı raporlarında geçerli"}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--danger)] text-white px-4 py-2.5 text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-50"
      >
        <Ban className="size-4" /> Kullanıcıyı Banla
      </button>
    </div>
  );
}

function actionConfirm(action: "dismiss" | "hide" | "ban"): string {
  if (action === "dismiss") return "Bu raporu reddetmek istediğine emin misin?";
  if (action === "hide") return "İçeriği gizleyip raporu çözmek istediğine emin misin?";
  return "Kullanıcıyı banlayıp raporu çözmek istediğine emin misin?";
}

function actionSuccess(action: "dismiss" | "hide" | "ban"): string {
  if (action === "dismiss") return "Rapor reddedildi";
  if (action === "hide") return "İçerik gizlendi";
  return "Kullanıcı banlandı";
}
