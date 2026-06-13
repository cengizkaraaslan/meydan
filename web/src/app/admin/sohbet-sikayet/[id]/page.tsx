import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMobileReport } from "@/lib/mobile-chat-store";

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Mesaj metnini admin için okunur hale getir ([voice]/[img] öneklerini link/etiketle). */
function renderText(text: string): React.ReactNode {
  if (text.startsWith("[voice]")) {
    const rest = text.slice("[voice]".length);
    const ci = rest.indexOf(":");
    const url = ci > 0 ? rest.slice(ci + 1) : rest;
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">
        🎤 Sesli mesaj (aç)
      </a>
    );
  }
  if (text.startsWith("[img]")) {
    const url = text.slice("[img]".length);
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">
        🖼️ Görsel (aç)
      </a>
    );
  }
  return text;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatReportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const r = await getMobileReport(id);
  if (!r) notFound();

  return (
    <div>
      <Link href="/admin/sohbet-sikayet" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] mb-4">
        <ArrowLeft className="size-4" /> Şikayetler
      </Link>

      <div className="rounded-2xl border border-[var(--border)] p-4 mb-5">
        <div className="text-lg font-bold">
          Şikayet edilen: <span className="text-[var(--danger)]">{r.reportedName}</span>
        </div>
        <div className="text-sm text-[var(--muted)] mt-1">Şikayet eden: {r.reporterName}</div>
        <div className="text-sm mt-2">
          <span className="text-[var(--muted)]">Neden:</span> <span className="font-medium">{r.reason}</span>
        </div>
        <div className="text-xs text-[var(--muted)] mt-1">{fmt(r.createdAt)}</div>
        <div className="text-[11px] text-[var(--muted)] mt-2 break-all opacity-70">
          {r.reportedIdentity}
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-2 text-[var(--muted)]">
        Sohbet ({r.messages.length} mesaj){!r.matchKey && " — bu şikayet bir sohbete bağlı değil"}
      </h3>

      {r.messages.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-6 text-center text-[var(--muted)] text-sm">
          Mesaj yok.
        </div>
      ) : (
        <div className="space-y-1.5">
          {r.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-2.5 text-sm ${
                m.isReported ? "border-[var(--danger)]/40 bg-[var(--danger)]/5" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-xs font-semibold ${m.isReported ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                  {m.senderName}
                  {m.isReported && " (şikayet edilen)"}
                </span>
                <span className="text-[10px] text-[var(--muted)]">{fmt(m.at)}</span>
              </div>
              <div className="whitespace-pre-wrap break-words">{renderText(m.text)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
