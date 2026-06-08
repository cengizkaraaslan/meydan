import { hashEventId } from "./attending";

/**
 * Bir kişinin (mock) rakamsal istatistikleri. Gerçek değil — id'den DETERMİNİSTİK
 * türetilir: her açılışta aynı sayılar (Math.random YOK).
 */
export interface PersonStats {
  attended: number;
  reactions: number;
  comments: number;
}

/**
 * Kişi id'sinden deterministik istatistik üretir. attending.ts'deki FNV hash'i
 * (hashEventId) tohum olarak kullanır. Aynı id her zaman aynı sonucu verir.
 *
 * Aralıklar: attended 3..48, reactions 10..539, comments 1..119.
 */
export function personStats(id: string): PersonStats {
  const base = hashEventId(id);
  const attended = 3 + (base % 46); // 3..48
  const reactions = 10 + (Math.floor(base / 46) % 530); // 10..539
  const comments = 1 + (Math.floor(base / 700) % 119); // 1..119
  return { attended, reactions, comments };
}
