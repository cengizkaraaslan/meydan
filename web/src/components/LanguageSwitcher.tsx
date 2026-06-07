"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Check } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { setLocaleCookie } from "@/lib/locale-actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const currentLocale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(locale: Locale) {
    if (locale === currentLocale) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setLocaleCookie(locale);
      setOpen(false);
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted-bg)] transition-colors"
        aria-label={t("language")}
        disabled={pending}
      >
        <Globe className="size-4" />
        <span className="hidden sm:inline">{LOCALE_LABELS[currentLocale].native}</span>
        <span className="sm:hidden">{LOCALE_LABELS[currentLocale].flag}</span>
      </button>
      {open && (
        <div
          className={cn(
            "absolute end-0 top-full mt-2 max-h-80 w-56 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl z-50 p-1.5",
            "animate-in fade-in slide-in-from-top-1",
          )}
          role="listbox"
        >
          {LOCALES.map((loc) => {
            const isActive = loc === currentLocale;
            return (
              <button
                key={loc}
                type="button"
                onClick={() => pick(loc)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "hover:bg-[var(--muted-bg)]",
                )}
                role="option"
                aria-selected={isActive}
              >
                <span className="text-lg">{LOCALE_LABELS[loc].flag}</span>
                <span className="flex-1 text-start">{LOCALE_LABELS[loc].native}</span>
                {isActive && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
