"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * EventCard / MovieCard grid'leri için: çocuklara `staggerChildren: 0.05` ile
 * fade-in sağlar. Çocuklar variants={...} initial="hidden" animate="show" tanımlamalı
 * ya da hiçbir variants tanımlamasa da çalışır (variants miras alınır).
 */
export function StaggerGrid({
  children,
  className,
  stagger = 0.05,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
