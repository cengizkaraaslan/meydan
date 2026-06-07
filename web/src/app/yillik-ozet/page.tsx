import type { Metadata } from "next";
import { WrappedSlides } from "@/components/WrappedSlides";

export const metadata: Metadata = {
  title: "Yıllık Özet — MeydanFest",
  description: "2026 yılında gittiğin etkinliklerin yıllık özeti. Konser, festival, tiyatro — hepsi tek bir hikayede.",
};

export default function YillikOzetPage() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mb-20 md:mb-0">
      <WrappedSlides />
    </div>
  );
}
