"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABELS, CITIES, type EventCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategory[];

const schema = z.object({
  title: z
    .string()
    .min(6, "Başlık en az 6 karakter olmalı")
    .max(120, "Başlık en fazla 120 karakter olabilir"),
  description: z
    .string()
    .min(20, "Açıklama en az 20 karakter olmalı")
    .max(800, "Açıklama en fazla 800 karakter olabilir"),
  suggestedDate: z
    .string()
    .min(1, "Tarih seç")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Geçerli bir tarih gir")
    .refine((v) => new Date(v).getTime() > Date.now(), "Tarih gelecekte olmalı"),
  suggestedVenue: z.string().min(3, "Mekân en az 3 karakter olmalı").max(120),
  suggestedCity: z.string().min(1, "Şehir seç"),
  category: z.enum(CATEGORIES as [EventCategory, ...EventCategory[]]),
});

type FormValues = z.infer<typeof schema>;

export function ProposalForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      suggestedDate: "",
      suggestedVenue: "",
      suggestedCity: "",
      category: "DIGER",
    },
  });

  async function onSubmit(values: FormValues) {
    // Mock submit — gerçek API entegrasyonu Faz 3'te.
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Önerin alındı! İncelemeden sonra listede görünecek.", {
      description: values.title,
    });
    router.push("/onerilen");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Field label="Başlık" error={errors.title?.message}>
        <input
          type="text"
          placeholder="Örn: Kadıköy Sahaf Buluşması"
          {...register("title")}
          className={inputClass(!!errors.title)}
        />
      </Field>

      <Field label="Açıklama" error={errors.description?.message}>
        <textarea
          rows={5}
          placeholder="Etkinlik fikrini anlat: amaç, hedef kitle, neden ilgi çekici…"
          {...register("description")}
          className={cn(inputClass(!!errors.description), "resize-y min-h-[120px]")}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Önerilen tarih ve saat" error={errors.suggestedDate?.message}>
          <input
            type="datetime-local"
            {...register("suggestedDate")}
            className={inputClass(!!errors.suggestedDate)}
          />
        </Field>

        <Field label="Kategori" error={errors.category?.message}>
          <select {...register("category")} className={inputClass(!!errors.category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Önerilen mekân" error={errors.suggestedVenue?.message}>
          <input
            type="text"
            placeholder="Örn: Moda Sahili"
            {...register("suggestedVenue")}
            className={inputClass(!!errors.suggestedVenue)}
          />
        </Field>

        <Field label="Şehir" error={errors.suggestedCity?.message}>
          <select {...register("suggestedCity")} className={inputClass(!!errors.suggestedCity)}>
            <option value="">Şehir seç…</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <motion.button
        type="submit"
        whileTap={{ scale: 0.98 }}
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-3 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary disabled:opacity-60 disabled:pointer-events-none"
      >
        <Send className="size-4" />
        {isSubmitting ? "Gönderiliyor…" : "Öneriyi gönder"}
      </motion.button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      {children}
      {error && <span className="block text-xs text-[var(--danger)]">{error}</span>}
    </label>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    "w-full rounded-xl border bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2",
    hasError
      ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/20"
      : "border-[var(--border)] focus:border-[var(--primary)] focus:ring-[var(--primary)]/20",
  );
}
