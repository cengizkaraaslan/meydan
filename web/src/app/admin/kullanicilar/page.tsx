const MOCK_USERS = [
  { id: "u1", name: "Ahmet Karaca", email: "ahmet@example.com", role: "USER", plan: "FREE", createdAt: "2026-04-12" },
  { id: "u2", name: "Elif Şen", email: "elif@example.com", role: "USER", plan: "PRO", createdAt: "2026-03-08" },
  { id: "u3", name: "Burak Demir", email: "burak@example.com", role: "ADMIN", plan: "BUSINESS", createdAt: "2026-02-21" },
  { id: "u4", name: "Zeynep Taş", email: "zeynep@example.com", role: "USER", plan: "FREE", createdAt: "2026-05-01" },
];

export default function AdminUsersPage() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="font-semibold">Kullanıcılar ({MOCK_USERS.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted-bg)]/50 text-[var(--muted)] text-xs uppercase tracking-wider">
            <tr>
              <th className="text-start px-4 py-3">İsim</th>
              <th className="text-start px-4 py-3">Email</th>
              <th className="text-start px-4 py-3">Rol</th>
              <th className="text-start px-4 py-3">Plan</th>
              <th className="text-start px-4 py-3">Kayıt</th>
              <th className="text-end px-4 py-3">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border)] hover:bg-[var(--muted-bg)]/40">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${u.role === "ADMIN" ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-[var(--primary)]/30" : "bg-[var(--muted-bg)] ring-[var(--border)]"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">{u.plan}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{u.createdAt}</td>
                <td className="px-4 py-3 text-end">
                  <button className="text-xs text-[var(--primary)] hover:underline me-3">Düzenle</button>
                  <button className="text-xs text-[var(--danger)] hover:underline">Yasakla</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
