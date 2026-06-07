import "server-only";

export type StorageFolder = "proposals" | "events" | "profile" | "comments" | "messages";

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
  /** Eğer presign yerine direct upload kullanılıyorsa (ör. Vercel Blob), client buradan FormData POST atar */
  uploadMethod?: "PUT" | "POST";
  /** Direct upload modunda backend route'a forward gerekirse */
  forwardToServerEndpoint?: string;
}

export interface EnvVarStatus {
  name: string;
  required: boolean;
  configured: boolean;
}

export interface ProviderMeta {
  id: string;
  displayName: string;
  description: string;
  url: string;
  freeTier: string;
}

export abstract class StorageProvider {
  abstract readonly meta: ProviderMeta;

  abstract isConfigured(): boolean;
  abstract envVars(): EnvVarStatus[];

  abstract presign(opts: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
  }): Promise<PresignedUpload>;

  abstract delete(key: string): Promise<void>;

  /** Production'da 'canli/', diğerlerinde 'test/' */
  protected uploadPrefix(): "test/" | "canli/" {
    return process.env.NODE_ENV === "production" ? "canli/" : "test/";
  }
}
