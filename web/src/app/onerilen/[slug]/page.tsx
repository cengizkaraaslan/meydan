import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, User2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProposalJoinButton } from "@/components/ProposalJoinButton";
import { getProposalBySlug } from "@/lib/proposals";
import { PROPOSAL_STATUS_LABELS } from "@/lib/proposal-data";
import { CATEGORY_LABELS } from "@/lib/types";
import { formatEventDate } from "@/lib/utils";

export const revalidate = 600;

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const proposal = await getProposalBySlug(slug);
  if (!proposal) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/onerilen"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        Tüm öneriler
      </Link>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        <article className="space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="category">{CATEGORY_LABELS[proposal.category]}</Badge>
            {proposal.status === "PROMOTED" && (
              <Badge variant="free">✨ {PROPOSAL_STATUS_LABELS.PROMOTED}</Badge>
            )}
            {proposal.status === "REJECTED" && (
              <Badge variant="warning">{PROPOSAL_STATUS_LABELS.REJECTED}</Badge>
            )}
            {proposal.status === "PENDING" && (
              <Badge variant="outline">{PROPOSAL_STATUS_LABELS.PENDING}</Badge>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            {proposal.title}
          </h1>

          <p className="text-base text-[var(--muted)] leading-relaxed whitespace-pre-line">
            {proposal.description}
          </p>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <InfoCard
              icon={<CalendarDays className="size-4" />}
              label="Önerilen tarih"
              value={formatEventDate(proposal.suggestedDate)}
            />
            <InfoCard
              icon={<MapPin className="size-4" />}
              label="Önerilen yer"
              value={`${proposal.suggestedVenue}, ${proposal.suggestedCity}`}
            />
            <InfoCard
              icon={<User2 className="size-4" />}
              label="Öneren"
              value={`${proposal.creatorName} (@${proposal.creatorUsername})`}
            />
          </div>
        </article>

        <aside className="lg:sticky lg:top-24 h-fit">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Bu öneriye katıl</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Eşik {proposal.threshold} kişiye ulaşırsa öneri gerçek etkinliğe dönüşür.
              </p>
            </div>
            <ProposalJoinButton
              proposalId={proposal.id}
              baseCount={proposal.attendeeCount}
              threshold={proposal.threshold}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-medium">{value}</div>
    </div>
  );
}
