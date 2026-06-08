/**
 * Favorilere ekleme bilgilendirme modalı için basit yayıncı (emitter).
 * Favoriye EKLEME yapıldığında notifyFavAdded() çağrılır; abone olan modal
 * sayaç kontrolünü (en fazla 3 kez) kendi içinde yapar.
 */
type Fn = () => void;
const listeners = new Set<Fn>();

/** Favori eklendi sinyalini dinlemek için kaydol. Kaldırma fonksiyonu döner. */
export function onFavAdded(cb: Fn): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Favoriye EKLEME yapıldığında çağrılır; tüm dinleyicileri tetikler. */
export function notifyFavAdded(): void {
  listeners.forEach((l) => l());
}
