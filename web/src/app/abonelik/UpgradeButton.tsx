"use client";

import Link from "next/link";
import { useState } from "react";
import type { SubscriptionPlan } from "@/lib/types";

type Props = {
  plan: SubscriptionPlan;
  isFree: boolean;
  popular: boolean;
  isLoggedIn: boolean;
};

export default function UpgradeButton({ plan, isFree, popular, isLoggedIn }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseClasses = `mt-7 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
    popular
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95"
      : "border border-[var(--border)] hover:bg-[var(--muted-bg)]"
  }`;

  if (isFree) {
    return (
      <Link href="/" className={`${baseClasses} inline-block text-center`}>
        Hemen başla
      </Link>
    );
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/giris?callbackUrl=/abonelik"
        className={`${baseClasses} inline-block text-center`}
      >
        Önce giriş yap
      </Link>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/iyzico/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { paymentPageUrl?: string; error?: string };
      if (!res.ok || !data.paymentPageUrl) {
        throw new Error(data.error ?? "Ödeme başlatılamadı.");
      }
      window.location.href = data.paymentPageUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`${baseClasses} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {loading ? "Yönlendiriliyor…" : "Yükselt"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-[var(--accent)]" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
