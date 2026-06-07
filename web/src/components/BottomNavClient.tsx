"use client";

import Link from "next/link";
import { motion, useAnimationControls } from "framer-motion";
import { Home, CalendarDays, Plus, MapPin, User } from "lucide-react";

const ICONS = {
  Home,
  CalendarDays,
  Plus,
  MapPin,
  User,
};

export type BottomNavIcon = keyof typeof ICONS;

interface NavItem {
  href: string;
  iconName: BottomNavIcon;
  label: string;
  primary: boolean;
}

export function BottomNavClient({ items, isLoggedIn }: { items: NavItem[]; isLoggedIn: boolean }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-[var(--border)] pb-[max(env(safe-area-inset-bottom),0px)]">
      <ul className="grid grid-cols-5">
        {items.map(({ href, iconName, label, primary }) => {
          const Icon = ICONS[iconName];
          return (
            <li key={href}>
              <NavLink
                href={href}
                Icon={Icon}
                label={label}
                primary={primary}
                isLoggedIn={isLoggedIn}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NavLink({
  href,
  Icon,
  label,
  primary,
  isLoggedIn,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  primary: boolean;
  isLoggedIn: boolean;
}) {
  const controls = useAnimationControls();
  const ringControls = useAnimationControls();

  async function handleTap() {
    if (!primary) {
      controls.start({ scale: [1, 0.92, 1], transition: { duration: 0.2 } });
      return;
    }
    if (!isLoggedIn) {
      // Çıkış yapmış kullanıcılar için: hızlı wiggle animasyonu
      controls.start({
        rotate: [0, -12, 12, -8, 8, 0],
        transition: { duration: 0.45, ease: "easeInOut" },
      });
      return;
    }
    // Giriş yapmış: press + glow halka genişlemesi
    controls.start({
      scale: [1, 0.9, 1.05, 1],
      transition: { duration: 0.32, ease: "easeOut" },
    });
    ringControls.start({
      scale: [1, 1.8],
      opacity: [0.55, 0],
      transition: { duration: 0.6, ease: "easeOut" },
    });
  }

  return (
    <Link
      href={href}
      onClick={handleTap}
      className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
    >
      {primary ? (
        <span className="relative -mt-4">
          <motion.span
            aria-hidden
            animate={ringControls}
            initial={{ scale: 1, opacity: 0 }}
            className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]"
            style={{ originX: 0.5, originY: 0.5 }}
          />
          <motion.span
            animate={controls}
            whileTap={{ scale: 0.9 }}
            className="relative grid size-11 place-items-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-lg ring-4 ring-[var(--background)]"
          >
            <Icon className="size-5" strokeWidth={2.5} />
          </motion.span>
        </span>
      ) : (
        <motion.span animate={controls} whileTap={{ scale: 0.85 }} className="block">
          <Icon className="size-5" />
        </motion.span>
      )}
      <span className={primary ? "font-semibold text-[var(--foreground)]" : ""}>
        {label}
      </span>
    </Link>
  );
}
