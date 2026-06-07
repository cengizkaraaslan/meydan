"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  applyPresetAction,
  resetThemeAction,
  updateThemeAction,
} from "@/lib/theme-actions";
import type { ThemeConfig, ThemeMode, ThemePreset } from "@/lib/theme-store";

interface ThemeEditorProps {
  initialTheme: ThemeConfig;
  presets: ThemePreset[];
}

export function ThemeEditor({ initialTheme, presets }: ThemeEditorProps) {
  const [draft, setDraft] = useState<ThemeConfig>(initialTheme);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function patch<K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await updateThemeAction(draft);
      if (!res.ok || !res.theme) {
        toast.error(res.error ?? "Tema kaydedilemedi");
        return;
      }
      toast.success("Tema kaydedildi");
      router.refresh();
    });
  }

  function reset() {
    if (!confirm("Tema varsayılana sıfırlansın mı?")) return;
    startTransition(async () => {
      const res = await resetThemeAction();
      if (res.theme) setDraft(res.theme);
      toast.success("Tema sıfırlandı");
      router.refresh();
    });
  }

  function applyPreset(presetId: string) {
    startTransition(async () => {
      const res = await applyPresetAction(presetId);
      if (!res.ok || !res.theme) {
        toast.error(res.error ?? "Preset uygulanamadı");
        return;
      }
      setDraft(res.theme);
      toast.success("Preset uygulandı");
      router.refresh();
    });
  }

  const modes: { value: ThemeMode; label: string; emoji: string }[] = [
    { value: "auto",  label: "Otomatik", emoji: "🌓" },
    { value: "light", label: "Açık",     emoji: "☀️" },
    { value: "dark",  label: "Koyu",     emoji: "🌙" },
  ];

  const fontOptions: { value: ThemeConfig["fontFamily"]; label: string }[] = [
    { value: "geist",  label: "Geist (varsayılan)" },
    { value: "inter",  label: "Inter" },
    { value: "system", label: "Sistem fontu" },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        {/* Hazır temalar */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-4 text-[var(--primary)]" />
            <h3 className="font-semibold">Hazır Temalar</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {presets.map((p) => {
              const isActive =
                p.config.primary === draft.primary &&
                p.config.accent === draft.accent;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  disabled={pending}
                  className={`relative text-start rounded-2xl border p-3 transition-all hover:shadow-md ${
                    isActive
                      ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/30"
                      : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    <span
                      className="size-8 rounded-lg shadow-sm"
                      style={{ background: p.config.primary }}
                    />
                    <span
                      className="size-8 rounded-lg shadow-sm"
                      style={{ background: p.config.accent }}
                    />
                  </div>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-[var(--muted)] line-clamp-1">{p.description}</div>
                  {isActive && (
                    <Check className="absolute top-2 end-2 size-4 text-[var(--primary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Renk paleti */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold mb-4">Renkler</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorPicker
              label="Birincil (CTA, vurgular)"
              value={draft.primary}
              onChange={(v) => patch("primary", v)}
            />
            <ColorPicker
              label="İkincil (Accent)"
              value={draft.accent}
              onChange={(v) => patch("accent", v)}
            />
            <ColorPicker
              label="Arka plan (Açık)"
              value={draft.backgroundLight}
              onChange={(v) => patch("backgroundLight", v)}
            />
            <ColorPicker
              label="Arka plan (Koyu)"
              value={draft.backgroundDark}
              onChange={(v) => patch("backgroundDark", v)}
            />
            <ColorPicker
              label="Metin (Açık)"
              value={draft.foregroundLight}
              onChange={(v) => patch("foregroundLight", v)}
            />
            <ColorPicker
              label="Metin (Koyu)"
              value={draft.foregroundDark}
              onChange={(v) => patch("foregroundDark", v)}
            />
          </div>
        </section>

        {/* Görünüm modu + radius + font */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="font-semibold mb-4">Görünüm</h3>

          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
              Mod
            </div>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => patch("mode", m.value)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                    draft.mode === m.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] hover:bg-[var(--muted-bg)]"
                  }`}
                >
                  <div className="text-xl mb-1">{m.emoji}</div>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Köşe Yumuşaklığı
              </div>
              <span className="text-sm tabular-nums font-medium">{draft.radius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={32}
              value={draft.radius}
              onChange={(e) => patch("radius", parseInt(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="mt-2 flex gap-1.5">
              {[0, 6, 14, 24].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => patch("radius", r)}
                  className="text-xs rounded-md border border-[var(--border)] px-2 py-1 hover:bg-[var(--muted-bg)]"
                >
                  {r === 0 ? "Köşeli" : `${r}px`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
              Font
            </div>
            <select
              value={draft.fontFamily}
              onChange={(e) =>
                patch("fontFamily", e.target.value as ThemeConfig["fontFamily"])
              }
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm"
            >
              {fontOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Aksiyon butonları */}
        <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur p-3 shadow-lg">
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-50"
          >
            <RotateCcw className="size-4" />
            Varsayılana dön
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2 text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 glow-primary"
          >
            <Save className="size-4" />
            {pending ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* Canlı önizleme */}
      <aside className="lg:sticky lg:top-24 self-start">
        <PreviewCard theme={draft} />
      </aside>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5 block">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 rounded-lg border border-[var(--border)] cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-mono"
        />
      </div>
    </label>
  );
}

function PreviewCard({ theme }: { theme: ThemeConfig }) {
  const radius = `${theme.radius}px`;
  return (
    <div
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm"
      style={{ borderRadius: theme.radius + 6 }}
    >
      <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
        Önizleme
      </div>

      {/* Mini örnek kart */}
      <div
        className="space-y-3 p-4 mb-4"
        style={{
          background: theme.backgroundLight,
          color: theme.foregroundLight,
          borderRadius: theme.radius,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div
          className="text-[11px] uppercase tracking-wider font-bold"
          style={{ color: theme.primary }}
        >
          KONSER
        </div>
        <div className="font-bold text-base">Örnek Etkinlik</div>
        <div className="text-xs opacity-70">İstanbul · 15 Haz 2026</div>
        <button
          type="button"
          className="text-xs font-semibold px-3 py-1.5"
          style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
            color: "#fff",
            borderRadius: theme.radius,
          }}
        >
          Bilet Al
        </button>
      </div>

      {/* Dark mode preview */}
      <div
        className="space-y-3 p-4"
        style={{
          background: theme.backgroundDark,
          color: theme.foregroundDark,
          borderRadius: theme.radius,
        }}
      >
        <div
          className="text-[11px] uppercase tracking-wider font-bold"
          style={{ color: theme.accent }}
        >
          FESTIVAL
        </div>
        <div className="font-bold text-base">Koyu Mod</div>
        <div className="text-xs opacity-70">Ankara · 22 Tem 2026</div>
        <button
          type="button"
          className="text-xs font-semibold px-3 py-1.5"
          style={{
            background: theme.primary,
            color: "#fff",
            borderRadius: theme.radius,
          }}
        >
          İncele
        </button>
      </div>

      <div className="mt-4 text-[10px] text-[var(--muted)] text-center">
        Radius: {radius} · Mode: {theme.mode}
      </div>
    </div>
  );
}
