"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Save, Send } from "lucide-react";
import { toast } from "sonner";
import { PhotoUpload } from "@/components/PhotoUpload";
import { CATEGORY_LABELS, CITIES, type EventCategory } from "@/lib/types";
import { createEventAction } from "@/lib/event-create-actions";
import { cn } from "@/lib/utils";

/** Submit hedefi: "PENDING_REVIEW" = Yayınla, "DRAFT" = Taslak (UI metni için). */
type SubmitIntent = "DRAFT" | "PENDING_REVIEW";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as EventCategory[];

const schema = z
  .object({
    title: z
      .string()
      .min(6, "Başlık en az 6 karakter olmalı")
      .max(120, "Başlık en fazla 120 karakter olabilir"),
    description: z
      .string()
      .min(20, "Açıklama en az 20 karakter olmalı")
      .max(1000, "Açıklama en fazla 1000 karakter olabilir"),
    category: z.enum(CATEGORIES as [EventCategory, ...EventCategory[]]),
    city: z.string().min(1, "Şehir seç"),
    venue: z.string().min(3, "Mekân en az 3 karakter olmalı").max(120),
    startsAt: z
      .string()
      .min(1, "Başlangıç tarihi seç")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Geçerli bir tarih gir"),
    endsAt: z
      .string()
      .optional()
      .refine(
        (v) => !v || !Number.isNaN(new Date(v).getTime()),
        "Geçerli bir bitiş tarihi gir",
      ),
    isFree: z.boolean(),
    priceMin: z
      .string()
      .optional()
      .refine(
        (v) => !v || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0),
        "Geçerli bir fiyat gir (≥ 0)",
      ),
    priceMax: z
      .string()
      .optional()
      .refine(
        (v) => !v || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0),
        "Geçerli bir fiyat gir (≥ 0)",
      ),
    ticketUrl: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^https?:\/\/\S+$/i.test(v),
        "Geçerli bir URL gir (https://…)",
      ),
    imageUrl: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.endsAt && val.startsAt) {
      const s = new Date(val.startsAt).getTime();
      const e = new Date(val.endsAt).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e <= s) {
        ctx.addIssue({
          code: "custom",
          path: ["endsAt"],
          message: "Bitiş, başlangıçtan sonra olmalı",
        });
      }
    }
    if (!val.isFree) {
      const min = val.priceMin ? Number(val.priceMin) : undefined;
      const max = val.priceMax ? Number(val.priceMax) : undefined;
      if (min == null && max == null) {
        ctx.addIssue({
          code: "custom",
          path: ["priceMin"],
          message: "Ücretli etkinlik için en az bir fiyat gir",
        });
      }
      if (min != null && max != null && max < min) {
        ctx.addIssue({
          code: "custom",
          path: ["priceMax"],
          message: "Maks. fiyat min'den küçük olamaz",
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

export function EventCreateForm() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<SubmitIntent | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      category: "DIGER",
      city: "",
      venue: "",
      startsAt: "",
      endsAt: "",
      isFree: true,
      priceMin: "",
      priceMax: "",
      ticketUrl: "",
      imageUrl: "",
    } as FormValues,
  });

  const isFree = useWatch({ control, name: "isFree" });
  const titleValue = useWatch({ control, name: "title" }) ?? "";

  async function submitWith(intent: SubmitIntent, values: FormValues) {
    setPendingStatus(intent);
    try {
      const priceMin =
        !values.isFree && values.priceMin ? Number(values.priceMin) : undefined;
      const priceMax =
        !values.isFree && values.priceMax ? Number(values.priceMax) : undefined;

      // Form alanlarını server action input'una map'le.
      const res = await createEventAction({
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        city: values.city,
        venue: values.venue.trim(),
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
        isFree: values.isFree,
        priceMin,
        priceMax,
        ticketUrl: values.ticketUrl ? values.ticketUrl : undefined,
        imageUrl: values.imageUrl ? values.imageUrl : undefined,
      });

      if (!res.ok || !res.slug) {
        toast.error("Etkinlik kaydedilemedi", {
          description: res.error ?? "Lütfen tekrar dene.",
        });
        return;
      }

      if (intent === "DRAFT") {
        // Şu an taslak/yayın ayrımı yok; her etkinlik anında yayınlanıyor.
        toast.success("Etkinlik kaydedildi", { description: values.title.trim() });
      } else {
        toast.success("Etkinlik yayınlandı", { description: values.title.trim() });
      }
      // Yayınlanan etkinliğin kendi sayfasına yönlendir (herkese görünür).
      router.push(`/etkinlik/${res.slug}`);
    } finally {
      setPendingStatus(null);
    }
  }

  const onPublish = handleSubmit((v) => submitWith("PENDING_REVIEW", v));
  const onSaveDraft = handleSubmit((v) => submitWith("DRAFT", v));

  const cityOptions = (
    <>
      {CITIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );

  return (
    <form onSubmit={onPublish} className="space-y-6 pb-6">
      {/* Görsel */}
      <div>
        <PhotoUpload
          folder="events"
          label="Kapak görseli (opsiyonel)"
          value={imageUrl}
          onChange={(url) => {
            setImageUrl(url);
            setValue("imageUrl", url ?? "", { shouldDirty: true });
          }}
        />
      </div>

      {/* Başlık */}
      <Field
        label="Başlık"
        hint={`${titleValue.length}/120`}
        error={errors.title?.message}
      >
        <input
          type="text"
          placeholder="Örn: Kadıköy Açık Hava Konseri"
          {...register("title")}
          className={inputClass(!!errors.title)}
        />
      </Field>

      {/* Açıklama */}
      <Field label="Açıklama" error={errors.description?.message}>
        <textarea
          rows={5}
          placeholder="Etkinliği detaylıca anlat: program, sanatçı, atmosfer, kim için…"
          {...register("description")}
          className={cn(inputClass(!!errors.description), "resize-y min-h-[140px]")}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Kategori" error={errors.category?.message}>
          <select {...register("category")} className={inputClass(!!errors.category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Şehir" error={errors.city?.message}>
          <select {...register("city")} className={inputClass(!!errors.city)}>
            <option value="">Şehir seç…</option>
            {cityOptions}
          </select>
        </Field>
      </div>

      <Field label="Mekân" error={errors.venue?.message}>
        <input
          type="text"
          placeholder="Örn: Volkswagen Arena"
          {...register("venue")}
          className={inputClass(!!errors.venue)}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Başlangıç" error={errors.startsAt?.message}>
          <input
            type="datetime-local"
            {...register("startsAt")}
            className={inputClass(!!errors.startsAt)}
          />
        </Field>
        <Field label="Bitiş (opsiyonel)" error={errors.endsAt?.message}>
          <input
            type="datetime-local"
            {...register("endsAt")}
            className={inputClass(!!errors.endsAt)}
          />
        </Field>
      </div>

      {/* Ücret toggle */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted-bg)]/40 p-4 space-y-4">
        <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
          <div>
            <div className="text-sm font-medium">Ücretsiz etkinlik</div>
            <div className="text-xs text-[var(--muted)]">
              Açıksa fiyat alanları gizlenir.
            </div>
          </div>
          <input
            type="checkbox"
            {...register("isFree")}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-[var(--border)] peer-checked:bg-[var(--success)] transition-colors"
          >
            <span className="absolute top-0.5 start-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
          </span>
        </label>

        {!isFree && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Min. fiyat (₺)" error={errors.priceMin?.message}>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="500"
                {...register("priceMin")}
                className={inputClass(!!errors.priceMin)}
              />
            </Field>
            <Field label="Maks. fiyat (₺)" error={errors.priceMax?.message}>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="1500"
                {...register("priceMax")}
                className={inputClass(!!errors.priceMax)}
              />
            </Field>
          </div>
        )}
      </div>

      <Field label="Bilet linki (opsiyonel)" error={errors.ticketUrl?.message}>
        <input
          type="url"
          placeholder="https://biletix.com/etkinlik/..."
          {...register("ticketUrl")}
          className={inputClass(!!errors.ticketUrl)}
        />
      </Field>

      {/* Gönder alanı — formun HEMEN ALTINDA (akış içinde; sabit bar değil → mobilde
          BottomNav'ın arkasında kalmaz). Mobilde tam genişlik & dikey, masaüstünde sağda. */}
      <div className="border-t border-[var(--border)] pt-5">
        <p className="text-xs text-[var(--muted)] mb-3">
          Yayınladığın etkinlik incelemeden sonra listede görünür.
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <motion.button
            type="button"
            onClick={onSaveDraft}
            whileTap={{ scale: 0.98 }}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-60 disabled:pointer-events-none w-full sm:w-auto"
          >
            <Save className="size-4" />
            {pendingStatus === "DRAFT" ? "Kaydediliyor…" : "Taslak olarak kaydet"}
          </motion.button>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-3 text-sm font-semibold hover:opacity-95 transition-opacity glow-primary disabled:opacity-60 disabled:pointer-events-none w-full sm:w-auto"
          >
            <Send className="size-4" />
            {pendingStatus === "PENDING_REVIEW" ? "Gönderiliyor…" : "Yayınla"}
          </motion.button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        {hint && <span className="text-[10px] text-[var(--muted)] tabular-nums">{hint}</span>}
      </span>
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
