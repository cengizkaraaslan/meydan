interface AvatarProps {
  /** Eğer varsa gerçek fotoğraf URL'i kullanılır */
  src?: string | null;
  /** Görüntülenecek ad — ilk harf fallback için */
  name: string;
  /** Tailwind size class (örn. "size-10") */
  size?: string;
  /** Fallback arka plan rengi (avatar yoksa) */
  color?: string;
  /** Ring/border efekti */
  ring?: boolean;
  className?: string;
}

/**
 * Tek bir kullanıcı avatarı. Sırayla:
 * 1) src varsa fotoğraf (randomuser.me, Google, R2)
 * 2) yoksa renkli arka plan + ilk harf
 */
export function Avatar({
  src,
  name,
  size = "size-9",
  color = "#7c3aed",
  ring = false,
  className = "",
}: AvatarProps) {
  const ringCls = ring ? "ring-2 ring-[var(--card)]" : "";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`${size} rounded-full object-cover ${ringCls} ${className}`}
      />
    );
  }
  return (
    <span
      title={name}
      className={`${size} grid place-items-center rounded-full text-white text-xs font-semibold shrink-0 ${ringCls} ${className}`}
      style={{ background: color }}
    >
      {(name?.[0] ?? "?").toUpperCase()}
    </span>
  );
}
