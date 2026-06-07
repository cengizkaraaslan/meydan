import "server-only";
import { StorageProvider } from "./StorageProvider";
import { R2Provider } from "./providers/R2Provider";
import { S3Provider } from "./providers/S3Provider";
import { BackblazeProvider } from "./providers/BackblazeProvider";
import { VercelBlobProvider } from "./providers/VercelBlobProvider";
import { SupabaseProvider } from "./providers/SupabaseProvider";

class StorageRegistry {
  private readonly providers = new Map<string, StorageProvider>();
  private activeOverride: string | null = null;

  register(p: StorageProvider) { this.providers.set(p.meta.id, p); }
  get(id: string): StorageProvider | undefined { return this.providers.get(id); }
  list(): StorageProvider[] { return [...this.providers.values()]; }

  defaultId(): string { return process.env.STORAGE_PROVIDER ?? "R2"; }

  activeId(): string { return this.activeOverride ?? this.defaultId(); }

  setActive(id: string): boolean {
    if (!this.providers.has(id)) return false;
    this.activeOverride = id;
    return true;
  }

  clearOverride() { this.activeOverride = null; }

  active(): StorageProvider {
    const fromActive = this.providers.get(this.activeId());
    if (fromActive && fromActive.isConfigured()) return fromActive;
    // Active configured değilse: configured olan ilk provider'ı kullan
    const fallback = [...this.providers.values()].find((p) => p.isConfigured());
    if (fallback) return fallback;
    // Hiçbiri configured değilse: active provider'ı yine de döner (isConfigured() false olur → 503 dönecek)
    return fromActive ?? this.providers.values().next().value!;
  }
}

export const storageRegistry = new StorageRegistry();
storageRegistry.register(new R2Provider());
storageRegistry.register(new S3Provider());
storageRegistry.register(new BackblazeProvider());
storageRegistry.register(new VercelBlobProvider());
storageRegistry.register(new SupabaseProvider());
