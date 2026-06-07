"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "./ui/Select";
import { NearestCityButton } from "./NearestCityButton";
import { CITIES } from "@/lib/types";

export function CalendarCitySelect({ currentCity }: { currentCity?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(v: string) {
    const next = new URLSearchParams(params);
    if (v) next.set("city", v);
    else next.delete("city");
    startTransition(() => router.push(`/takvim?${next.toString()}`));
  }

  return (
    <div className="w-full sm:w-64 space-y-2">
      <NearestCityButton onResolve={onChange} variant="compact" className="!w-auto" />
      <Select
        value={currentCity ?? ""}
        onChange={onChange}
        options={[
          { value: "", label: "Tüm şehirler" },
          ...CITIES.map((c) => ({ value: c, label: c })),
        ]}
        label="Şehir"
        disabled={pending}
      />
    </div>
  );
}
