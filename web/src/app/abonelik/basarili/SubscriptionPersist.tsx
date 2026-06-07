"use client";

import { useEffect } from "react";
import type { SubscriptionPlan } from "@/lib/types";

const STORAGE_KEY = "meydanfest_subscription";

export default function SubscriptionPersist({
  plan,
  paymentId,
}: {
  plan: SubscriptionPlan;
  paymentId: string;
}) {
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          plan,
          paymentId,
          activatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // localStorage erişimi engellenmiş olabilir; sessizce yut.
    }
  }, [plan, paymentId]);

  return null;
}
