import "server-only";
import { nanoid } from "nanoid";
import { StorageProvider, type PresignedUpload, type StorageFolder, type EnvVarStatus, type ProviderMeta } from "../StorageProvider";

const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
};

export class SupabaseProvider extends StorageProvider {
  readonly meta: ProviderMeta = {
    id: "SUPABASE",
    displayName: "Supabase Storage",
    description: "Postgres + storage tek pakette. Open-source, self-host edilebilir.",
    url: "https://supabase.com/storage",
    freeTier: "1 GB depolama + 2 GB bandwidth/ay",
  };

  private get bucket(): string {
    return process.env.SUPABASE_BUCKET ?? "etkinlik";
  }

  isConfigured(): boolean {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  envVars(): EnvVarStatus[] {
    return [
      { name: "SUPABASE_URL",                required: true,  configured: !!process.env.SUPABASE_URL },
      { name: "SUPABASE_SERVICE_ROLE_KEY",   required: true,  configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
      { name: "SUPABASE_BUCKET",             required: false, configured: !!process.env.SUPABASE_BUCKET },
    ];
  }

  async presign(opts: { folder: StorageFolder; filename: string; contentType: string }): Promise<PresignedUpload> {
    const ext = EXT_FOR_TYPE[opts.contentType] ?? opts.filename.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${this.uploadPrefix()}${opts.folder}/${nanoid(16)}.${ext}`;
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supa.storage.from(this.bucket).createSignedUploadUrl(key);
    if (error || !data) throw new Error(`Supabase presign hatası: ${error?.message ?? "unknown"}`);
    const { data: pub } = supa.storage.from(this.bucket).getPublicUrl(key);
    return {
      uploadUrl: data.signedUrl,
      key,
      publicUrl: pub.publicUrl,
      expiresIn: 7200,
      uploadMethod: "PUT",
    };
  }

  async delete(key: string): Promise<void> {
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await supa.storage.from(this.bucket).remove([key]);
  }
}
