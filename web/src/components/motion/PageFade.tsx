"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Sayfa içeriği için kısa giriş animasyonu — Next.js 16 server component'lerinin
 * dışını sarmak için kullan. Global page-transition yerine seçili sayfaları sar.
 */
export function PageFade({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
