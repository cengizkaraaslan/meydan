"use client";

import { Avatar } from "./ui/Avatar";

interface StoryRingProps {
  name: string;
  avatarUrl?: string;
  color?: string;
  hasUnviewed: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  label?: string;
}

/**
 * Instagram-tarzı gradient ring'li yuvarlak avatar.
 * `hasUnviewed` true ise renkli gradient, false ise muted gri.
 */
export function StoryRing({
  name,
  avatarUrl,
  color = "#7c3aed",
  hasUnviewed,
  size = "md",
  onClick,
  label,
}: StoryRingProps) {
  const outer = size === "sm" ? "size-14" : "size-16 sm:size-[72px]";
  const inner = size === "sm" ? "size-12" : "size-[58px] sm:size-[64px]";
  const avatarSize = size === "sm" ? "size-11" : "size-[54px] sm:size-[60px]";

  const ringStyle = hasUnviewed
    ? {
        background:
          "conic-gradient(from 180deg, #f59e0b, #ec4899, #7c3aed, #06b6d4, #f59e0b)",
      }
    : { background: "var(--border)" };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? `${name} hikayesi`}
      className="group flex flex-col items-center gap-1.5 shrink-0 focus:outline-none"
    >
      <span
        className={`${outer} rounded-full p-[3px] grid place-items-center transition-transform group-hover:scale-105 group-active:scale-95`}
        style={ringStyle}
      >
        <span
          className={`${inner} rounded-full bg-[var(--card)] grid place-items-center p-[2px]`}
        >
          <Avatar
            src={avatarUrl ?? null}
            name={name}
            color={color}
            size={avatarSize}
            className="rounded-full"
          />
        </span>
      </span>
      <span className="max-w-[72px] truncate text-[11px] leading-tight text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
        {name.split(" ")[0]}
      </span>
    </button>
  );
}
