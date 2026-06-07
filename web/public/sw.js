/* MeydanFest — KILL-SWITCH service worker.
 *
 * Eski/cache-first SW sürümleri eski JS'i inatla serve edip "güncelleme ulaşmıyor"
 * sorununa yol açıyordu (ör. ilçe dropdown'u eski fetch'li sürümde boş kalıyordu).
 * Bu sürüm: tüm cache'leri siler, kendini kaldırır, hiçbir isteği yakalamaz →
 * her şey doğrudan ağdan (her zaman taze). Push ileride temiz bir update
 * stratejisiyle geri eklenecek.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* yoksay */
      }
      try {
        await self.clients.claim();
      } catch {
        /* yoksay */
      }
      // SW'yi tamamen kaldır → bundan sonra tarayıcı doğrudan ağdan çeker.
      try {
        await self.registration.unregister();
      } catch {
        /* yoksay */
      }
    })(),
  );
});

/* fetch handler YOK — hiçbir isteği yakalamaz/cache'lemez. */
