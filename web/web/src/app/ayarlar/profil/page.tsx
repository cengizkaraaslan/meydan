import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { ProfileSettingsClient } from "@/components/ProfileSettingsClient";
import { ProfileWall } from "@/components/ProfileWall";
import { listPhotosByUserSlug } from "@/lib/gallery-store";
import { profileSlugFromEmail } from "@/lib/social-data";

export const dynamic = "force-dynamic";

export default async function ProfilAyarlarPage() {
  const session = await auth().catch(() => null);
  const email = session?.user?.email ?? null;
  const slug = email ? profileSlugFromEmail(email) : null;
  const wallPhotos = slug ? await listPhotosByUserSlug(slug) : [];
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <Link
        href="/ayarlar"
        className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] mb-3"
      >
        <ArrowLeft className="size-3 rtl:rotate-180" /> Ayarlar
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Profil</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Profil fotoğrafın ve bilgilerin diğer kullanıcılara görünür.
        </p>
      </header>
      <ProfileSettingsClient
        initialAuthName={session?.user?.name ?? null}
        initialAuthImage={session?.user?.image ?? null}
      />

      {slug && (
        <>
          <ProfileWall photos={wallPhotos} isOwn />
          <Link
            href={`/profil/${slug}`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--primary)] hover:underline"
          >
            Herkese açık profilini gör <ExternalLink className="size-3.5" />
          </Link>
        </>
      )}
    </div>
  );
}
