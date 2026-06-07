import Link from "next/link";
import { ExternalLink, HardDrive, RefreshCcw, Check } from "lucide-react";
import { storageRegistry } from "@/lib/storage/StorageRegistry";
import { setActiveStorageProvider, resetStorageOverride } from "@/lib/storage-actions";

export const dynamic = "force-dynamic";

export default function StorageAdminPage() {
  const providers = storageRegistry.list();
  const activeId = storageRegistry.activeId();
  const defaultId = storageRegistry.defaultId();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Depolama Sağlayıcısı</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Foto/video yüklemeleri için kullanılacak sağlayıcı. Default <code className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5">{defaultId}</code>.
            Dev'de <code>test/</code>, production'da <code>canli/</code> klasörüne yazar.
          </p>
        </div>
        <form action={async () => { "use server"; await resetStorageOverride(); }}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted-bg)]"
          >
            <RefreshCcw className="size-3.5" /> Default'a dön
          </button>
        </form>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {providers.map((p) => {
          const isActive = p.meta.id === activeId;
          const isDefault = p.meta.id === defaultId;
          const configured = p.isConfigured();
          const envs = p.envVars();

          return (
            <div
              key={p.meta.id}
              className={`rounded-2xl border bg-[var(--card)] p-5 space-y-4 transition-all ${
                isActive ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20 glow-primary" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`grid size-10 place-items-center rounded-xl ${configured ? "bg-[var(--primary)]/12 text-[var(--primary)]" : "bg-[var(--muted-bg)] text-[var(--muted)]"}`}>
                    <HardDrive className="size-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{p.meta.displayName}</h3>
                      {isDefault && (
                        <span className="rounded-full bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/30 px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{p.meta.description}</p>
                    <div className="mt-1 text-xs">
                      <Link href={p.meta.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline">
                        Dokümantasyon <ExternalLink className="size-3" />
                      </Link>
                      <span className="text-[var(--muted)] ms-3">{p.meta.freeTier}</span>
                    </div>
                  </div>
                </div>
                {isActive && (
                  <span className="rounded-full bg-[var(--success)]/15 text-[var(--success)] ring-1 ring-[var(--success)]/30 px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1 shrink-0">
                    <Check className="size-3" /> Aktif
                  </span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                {envs.map((env) => (
                  <div
                    key={env.name}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                      env.configured
                        ? "border-[var(--success)]/30 bg-[var(--success)]/5"
                        : env.required
                          ? "border-dashed border-[var(--danger)]/30 bg-[var(--danger)]/5"
                          : "border-dashed border-[var(--border)] bg-[var(--muted-bg)]/30"
                    }`}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      {env.name} {env.required && <span className="text-[var(--danger)]">*</span>}
                    </div>
                    <div className={`mt-0.5 font-medium ${env.configured ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>
                      {env.configured ? "✓ ayarlandı" : env.required ? "× eksik" : "opsiyonel"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs">
                  {configured ? (
                    <span className="text-[var(--success)]">✓ Hazır</span>
                  ) : (
                    <span className="text-[var(--accent)]">⚠ Env değişkenleri eksik</span>
                  )}
                </div>
                {!isActive && (
                  <form action={async () => { "use server"; await setActiveStorageProvider(p.meta.id); }}>
                    <button
                      type="submit"
                      disabled={!configured}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-sm font-medium hover:opacity-95 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Aktif yap
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="font-semibold mb-2">Notlar</h3>
        <ul className="text-sm text-[var(--muted)] space-y-1.5">
          <li>• Default sağlayıcı <code>STORAGE_PROVIDER</code> env değişkeniyle kontrol edilir (varsayılan: <code>R2</code>)</li>
          <li>• Bu sayfadan yapılan değişiklik <strong>in-memory</strong>'dir → server restart'ta default'a döner. Kalıcı için env değişkenini güncelle.</li>
          <li>• Tüm provider'lar aynı klasör yapısını kullanır: <code>{`{test|canli}/{folder}/{nanoid}.{ext}`}</code></li>
          <li>• PhotoUpload component'i provider değişikliğine duyarsız — sadece API endpoint çağırır.</li>
        </ul>
      </div>
    </div>
  );
}
