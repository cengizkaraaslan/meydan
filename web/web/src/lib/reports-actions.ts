"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  checkRateLimit,
  createReport,
  getReport,
  updateReportStatus,
  type ReportReason,
  type ReportTarget,
} from "./reports-store";

const VALID_TARGETS: ReportTarget[] = ["comment", "user", "event"];
const VALID_REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "hate",
  "inappropriate",
  "scam",
  "other",
];

export async function submitReportAction(input: {
  target: ReportTarget;
  targetId: string;
  targetExcerpt: string;
  targetContext?: string;
  reason: ReportReason;
  note: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.email) {
    return { ok: false, error: "Rapor göndermek için giriş yapmalısın" };
  }

  if (!VALID_TARGETS.includes(input.target)) {
    return { ok: false, error: "Geçersiz hedef" };
  }
  if (!VALID_REASONS.includes(input.reason)) {
    return { ok: false, error: "Geçersiz sebep" };
  }
  if (!input.targetId || input.targetId.length > 200) {
    return { ok: false, error: "Geçersiz hedef kimliği" };
  }

  const reporterEmail = session.user.email;

  // Rate limit (silent success on hit to prevent enumeration)
  if (!checkRateLimit(reporterEmail)) {
    return { ok: true };
  }

  const report = createReport({
    target: input.target,
    targetId: input.targetId,
    targetExcerpt: (input.targetExcerpt ?? "").trim(),
    targetContext: input.targetContext,
    reason: input.reason,
    note: (input.note ?? "").trim(),
    reporterEmail,
  });

  console.log(
    `[reports] new id=${report.id} target=${report.target}:${report.targetId} reason=${report.reason} by=${reporterEmail}`,
  );

  revalidatePath("/admin/raporlar");
  return { ok: true, id: report.id };
}

export async function resolveReportAction(
  id: string,
  action: "dismiss" | "hide" | "ban",
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.email) {
    return { ok: false, error: "Yetkisiz" };
  }

  // TODO: Faz X - gerçek admin rol kontrolü (session.user.role === "ADMIN")
  // Şimdilik mock olduğu için giriş yapmış her kullanıcıya izin veriyoruz.

  const report = getReport(id);
  if (!report) {
    return { ok: false, error: "Rapor bulunamadı" };
  }

  const newStatus = action === "dismiss" ? "dismissed" : "actioned";
  const updated = updateReportStatus(
    id,
    newStatus,
    session.user.email,
    action,
  );

  if (!updated) {
    return { ok: false, error: "Rapor güncellenemedi" };
  }

  if (action === "hide") {
    // TODO: Faz X - hedef içeriği gerçekten gizle (yorum.hidden=true, etkinlik.status=hidden vb.)
    console.log(
      `[reports] HIDE target=${report.target}:${report.targetId} (mock - no-op)`,
    );
  } else if (action === "ban") {
    // TODO: Faz X - kullanıcıyı gerçekten banla (user.banned=true)
    console.log(
      `[reports] BAN target=${report.target}:${report.targetId} (mock - no-op)`,
    );
  } else {
    console.log(`[reports] DISMISS id=${id}`);
  }

  revalidatePath("/admin/raporlar");
  revalidatePath(`/admin/raporlar/${id}`);
  return { ok: true };
}
