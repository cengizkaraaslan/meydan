import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/lib/auth-actions";

export default async function LoginPage() {
  const t = await getTranslations("nav");
  const session = await auth();
  if (session?.user) redirect("/");

  const oauthConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-16">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] grid place-items-center text-white text-2xl glow-primary">
          ✦
        </div>
        <h1 className="mt-5 text-2xl font-bold">{t("login")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Etkinliklere RSVP yap, yorumla, fiyat alarmı kur.
        </p>

        <form action={async () => { "use server"; await signInWithGoogle(); }}>
          <button
            type="submit"
            disabled={!oauthConfigured}
            className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleIcon /> Google ile devam et
          </button>
        </form>

        {!oauthConfigured && (
          <p className="mt-4 text-xs text-[var(--accent)]">
            ⚠ AUTH_GOOGLE_ID & AUTH_GOOGLE_SECRET ayarlanmamış. Buton şu an devre dışı.
          </p>
        )}

        <p className="mt-6 text-xs text-[var(--muted)]">
          Giriş yaparak{" "}
          <Link href="#" className="underline">Kullanım Koşulları</Link> ve{" "}
          <Link href="#" className="underline">Gizlilik Politikası</Link>'nı kabul edersin.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.4 2.8l5.7-5.7C33.6 7 29 5 24 5 13.5 5 5 13.5 5 24s8.5 19 19 19c10.5 0 19-8.5 19-19 0-1.3-.1-2.5-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c2.8 0 5.4 1.1 7.4 2.8l5.7-5.7C33.6 7 29 5 24 5 16.1 5 9.3 9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43c5 0 9.5-1.9 12.9-5l-6-5.1c-1.9 1.3-4.2 2.1-6.9 2.1-5.3 0-9.7-3-11.3-7L6 32.7C9 38.7 16 43 24 43z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4-4.3 5.2.3 0 .3 0 0 0l6 5.1C36.6 39 43 34 43 24c0-1.3-.1-2.5-.4-3.5z"/>
    </svg>
  );
}
