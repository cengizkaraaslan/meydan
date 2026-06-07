"use server";
import { revalidatePath } from "next/cache";
import { storageRegistry } from "@/lib/storage/StorageRegistry";

export async function setActiveStorageProvider(id: string) {
  const ok = storageRegistry.setActive(id);
  if (!ok) return { ok: false as const, error: `Provider '${id}' bulunamadı.` };
  revalidatePath("/admin/depolama");
  return { ok: true as const };
}

export async function resetStorageOverride() {
  storageRegistry.clearOverride();
  revalidatePath("/admin/depolama");
  return { ok: true as const };
}
