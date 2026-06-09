"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff, RefreshCw } from "lucide-react";

interface RealUser {
  type: "real";
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
}

/** Gerçek (girişli) kullanıcıları listeler; admin yap / adminliği kaldır. */
export function UsersAdminClient({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<RealUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/users?email=${encodeURIComponent(adminEmail)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(res.status === 403 ? "Yetkiniz yok" : `HTTP ${res.status}`);
      const data = await res.json();
      const real: RealUser[] = (Array.isArray(data.users) ? data.users : []).filter(
        (u: { type?: string }) => u.type === "real",
      );
      setUsers(real);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri alınamadı");
    } finally {
      setLoading(false);
    }
  }, [adminEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleRole(u: RealUser) {
    const makeAdmin = u.role !== "ADMIN";
    const next = makeAdmin ? "ADMIN" : "USER";
    const who = u.name || u.email || "kullanıcı";
    if (!window.confirm(makeAdmin ? `${who} admin yapılsın mı?` : `${who} adminlikten çıkarılsın mı?`)) return;
    setBusyId(u.id);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: adminEmail, userId: u.id, role: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: next } : x)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <h2 className="font-semibold">Kullanıcılar ({users.length})</h2>
        <button
          onClick={() => { setLoading(true); void load(); }}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <RefreshCw className="size-3.5" /> Yenile
        </button>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center text-[var(--muted)]">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 text-sm text-[var(--danger)]">{error}</div>
      ) : users.length === 0 ? (
        <div className="p-6 text-sm text-[var(--muted)]">Henüz girişli kullanıcı yok.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted-bg)]/50 text-[var(--muted)] text-xs uppercase tracking-wider">
              <tr>
                <th className="text-start px-4 py-3">İsim</th>
                <th className="text-start px-4 py-3">Email</th>
                <th className="text-start px-4 py-3">Rol</th>
                <th className="text-start px-4 py-3">Kayıt</th>
                <th className="text-end px-4 py-3">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === "ADMIN";
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="border-t border-[var(--border)] hover:bg-[var(--muted-bg)]/40">
                    <td className="px-4 py-3 font-medium">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{u.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ring-1 ${
                          isAdmin
                            ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30"
                            : "bg-[var(--muted-bg)] ring-[var(--border)]"
                        }`}
                      >
                        {u.role ?? "USER"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-end">
                      <button
                        onClick={() => toggleRole(u)}
                        disabled={busy}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 disabled:opacity-60 ${
                          isAdmin
                            ? "text-[var(--danger)] ring-[var(--danger)]/30 hover:bg-[var(--danger)]/10"
                            : "text-[var(--primary)] ring-[var(--primary)]/30 hover:bg-[var(--primary)]/10"
                        }`}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : isAdmin ? (
                          <ShieldOff className="size-3.5" />
                        ) : (
                          <ShieldCheck className="size-3.5" />
                        )}
                        {isAdmin ? "Adminliği kaldır" : "Admin yap"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
