import "server-only";
import { MOCK_PROPOSALS, type ProposalItem } from "./proposal-data";

export async function getProposals(): Promise<ProposalItem[]> {
  // Sıralama: önce pinned (admin postları), sonra PENDING (en çok katılım yüzdesi),
  // sonra PROMOTED, sonra REJECTED.
  const sorted = [...MOCK_PROPOSALS].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const order: Record<ProposalItem["status"], number> = { PENDING: 0, PROMOTED: 1, REJECTED: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const pa = a.threshold > 0 ? a.attendeeCount / a.threshold : a.attendeeCount;
    const pb = b.threshold > 0 ? b.attendeeCount / b.threshold : b.attendeeCount;
    return pb - pa;
  });
  return sorted;
}

export async function getProposalBySlug(slug: string): Promise<ProposalItem | null> {
  return MOCK_PROPOSALS.find((p) => p.slug === slug) ?? null;
}
