import { getTheme, THEME_PRESETS } from "@/lib/theme-store";
import { ThemeEditor } from "@/components/admin/ThemeEditor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tema · Yönetim · MeydanFest" };

export default async function AdminThemePage() {
  const theme = await getTheme();
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">🎨 Tema</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Site genelindeki renkler, köşe yumuşaklığı ve görünüm modunu buradan
          değiştir. Kayıt anında her sayfa için geçerli olur.
        </p>
      </header>

      <ThemeEditor initialTheme={theme} presets={THEME_PRESETS} />
    </div>
  );
}
