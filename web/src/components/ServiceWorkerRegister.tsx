"use client";

import { useEffect } from "react";

/**
 * Service worker KAYIT ETMİYOR; aksine var olan (eski/buggy) SW'leri ve tüm
 * cache'leri temizliyor. Eski cache-first SW'ler eski JS'i serve edip "güncelleme
 * ulaşmıyor" sorununa yol açıyordu (ilçe dropdown'u eski sürümde boş kalıyordu).
 * Böylece her kullanıcı doğrudan ağdan taze içerik alır.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
      .catch(() => {});

    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {})))
        .catch(() => {});
    }
  }, []);

  return null;
}
