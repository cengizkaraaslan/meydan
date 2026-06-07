"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Kütüphanesiz üst yükleme çubuğu (YouTube tarzı). İç linke tıklanınca başlar,
 * yeni route commit olunca %100'e gidip kaybolur. Sayfa geçişlerinde "yükleniyor"
 * hissi verir. useSearchParams kullandığı için layout'ta <Suspense> ile sarılmalı.
 */
export function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const grow = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  function stopGrow() {
    if (grow.current) {
      clearInterval(grow.current);
      grow.current = null;
    }
  }

  function start() {
    if (activeRef.current) return;
    activeRef.current = true;
    setVisible(true);
    setWidth(8);
    stopGrow();
    grow.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 180);
  }

  // İç linke tıklanınca başlat (capture: framework navigasyonundan önce)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      const target = a.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank" || a.hasAttribute("download")) return;
      try {
        const url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.search === location.search) return;
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Route commit oldu → tamamla. (pathname/searchParams değişince çalışır)
  useEffect(() => {
    if (!activeRef.current) return;
    stopGrow();
    setWidth(100);
    const t = setTimeout(() => {
      setVisible(false);
      activeRef.current = false;
      setWidth(0);
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{ position: "fixed", top: 0, insetInline: 0, zIndex: 9999, height: 3, pointerEvents: "none" }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: "linear-gradient(90deg, var(--primary), var(--accent, var(--primary)))",
          boxShadow: "0 0 10px var(--primary), 0 0 4px var(--primary)",
          borderRadius: "0 2px 2px 0",
          transition: "width 0.2s ease-out, opacity 0.25s ease",
          opacity: width >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
