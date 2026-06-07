"use server";

// In-memory store of blocked usernames + reports (mock; replace with DB later).
const blockedSet = new Set<string>();

interface ReportRecord {
  id: string;
  username: string;
  reason: string;
  details: string;
  createdAt: Date;
}

const reportLog: ReportRecord[] = [];

export async function getBlockedUsernames(): Promise<Set<string>> {
  return new Set(blockedSet);
}

export async function isBlocked(username: string): Promise<boolean> {
  return blockedSet.has(username.toLowerCase());
}

export async function blockUser(username: string): Promise<{ ok: true; blocked: true }> {
  const u = username.toLowerCase();
  blockedSet.add(u);
  console.log(`[safety] block: ${u}`);
  return { ok: true, blocked: true };
}

export async function unblockUser(username: string): Promise<{ ok: true; blocked: false }> {
  const u = username.toLowerCase();
  blockedSet.delete(u);
  console.log(`[safety] unblock: ${u}`);
  return { ok: true, blocked: false };
}

export async function reportUser(
  username: string,
  reason: string,
  details: string,
): Promise<{ ok: true; id: string }> {
  const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record: ReportRecord = {
    id,
    username: username.toLowerCase(),
    reason,
    details: details.trim(),
    createdAt: new Date(),
  };
  reportLog.push(record);
  console.log(
    `[safety] report id=${id} user=@${record.username} reason="${reason}" details="${record.details.slice(0, 120)}"`,
  );
  return { ok: true, id };
}
