import { Aurora } from "../theme/aurora";

export interface CategoryMeta {
  key: string;
  label: string;
  emoji: string;
  gradient: readonly [string, string];
}

export const CATEGORIES: CategoryMeta[] = [
  { key: "KONSER", label: "Konser", emoji: "🎸", gradient: Aurora.pinkViolet },
  { key: "FESTIVAL", label: "Festival", emoji: "🎉", gradient: Aurora.violetBlue },
  { key: "TIYATRO", label: "Tiyatro", emoji: "🎭", gradient: ["#F59E0B", "#EC4899"] },
  { key: "STANDUP", label: "Stand-up", emoji: "🎙️", gradient: ["#A855F7", "#6366F1"] },
  { key: "SERGI", label: "Sergi", emoji: "🖼️", gradient: Aurora.cyanBlue },
  { key: "ATOLYE", label: "Atölye", emoji: "🧑‍🎨", gradient: ["#34D399", "#22D3EE"] },
  { key: "SPOR", label: "Spor", emoji: "⚽", gradient: ["#22D3EE", "#6366F1"] },
  { key: "COCUK", label: "Çocuk", emoji: "🧸", gradient: ["#F5C24B", "#F97316"] },
  { key: "DIGER", label: "Diğer", emoji: "✨", gradient: Aurora.auroraGlow as unknown as [string, string] },
];

export const CATEGORY_MAP: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
);

export function catMeta(key: string): CategoryMeta {
  return CATEGORY_MAP[key] ?? CATEGORY_MAP.DIGER;
}

/** Öne çıkan şehirler (filtre çipleri için). */
export const CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya",
  "Eskişehir", "Adana", "Konya", "Kayseri", "Trabzon", "Mersin",
];
