"use client";

import { useState, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  fullWidth?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Seç…",
  disabled,
  className,
  label,
  fullWidth = true,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className={cn("relative", fullWidth && "w-full", className)}>
      {label && <div className="text-xs font-medium text-[var(--muted)] mb-1.5">{label}</div>}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "w-full rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm text-start inline-flex items-center justify-between gap-2 transition-colors",
          "hover:border-[var(--primary)]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "border-[var(--primary)] ring-2 ring-[var(--primary)]/20",
        )}
      >
        <span className={cn("truncate", !current && "text-[var(--muted)]")}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-1.5 w-full max-h-72 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-1"
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-start rounded-lg px-2.5 py-2 text-sm flex items-center gap-2 transition-colors",
                      active
                        ? "bg-[var(--primary)]/12 text-[var(--primary)] font-medium"
                        : "text-[var(--foreground)] hover:bg-[var(--muted-bg)]",
                    )}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {active && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
