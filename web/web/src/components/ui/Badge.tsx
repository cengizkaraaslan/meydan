import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Variant = "default" | "free" | "category" | "outline" | "warning";

const variantClasses: Record<Variant, string> = {
  default: "bg-[var(--muted-bg)] text-[var(--foreground)]",
  free: "bg-[var(--success)]/15 text-[var(--success)] ring-1 ring-[var(--success)]/30",
  category: "bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/20",
  outline: "border border-[var(--border)]",
  warning: "bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/30",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
