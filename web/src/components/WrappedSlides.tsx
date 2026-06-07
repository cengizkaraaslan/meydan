"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Music2,
  Theater,
  Trophy,
  Sparkles,
  MapPin,
  PartyPopper,
  Share2,
  Pause,
  Play,
  Camera,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

/** ============== Slide data (hardcoded, deterministic) ============== */

interface Slide {
  id: string;
  bg: string;        // background gradient
  emoji: string;     // big hero emoji
  title: string;     // small eyebrow
  bigText: string;   // huge number or word
  subtitle: string;  // descriptive line
  /** Slayta özel ek görsel (avatar/küçük sayılar vb.) için key. */
  variant: "particles" | "category" | "buddy" | "hours" | "city" | "final";
  data?: Record<string, string | number>;
}

const SLIDES: Slide[] = [
  {
    id: "events",
    bg: "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)",
    emoji: "🎉",
    title: "Bu yıl",
    bigText: "12",
    subtitle: "etkinliğe gittin",
    variant: "particles",
  },
  {
    id: "category",
    bg: "linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)",
    emoji: "🎸",
    title: "En sevdiğin kategori",
    bigText: "Konser",
    subtitle: "5 konser • 3 festival • 2 tiyatro",
    variant: "category",
    data: { konser: 5, festival: 3, tiyatro: 2 },
  },
  {
    id: "buddy",
    bg: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    emoji: "🤝",
    title: "En çok birlikte gittiğin",
    bigText: "Ahmet",
    subtitle: "5 etkinliği birlikte yaşadınız",
    variant: "buddy",
    data: { name: "Ahmet Karaca", count: 5, color: "#7c3aed" },
  },
  {
    id: "hours",
    bg: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
    emoji: "⏱️",
    title: "Toplamda",
    bigText: "14.5 saat",
    subtitle: "ekibin seninle birlikteydi",
    variant: "hours",
    data: { hours: 14.5 },
  },
  {
    id: "city",
    bg: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
    emoji: "🌆",
    title: "En sevdiğin şehir",
    bigText: "İstanbul",
    subtitle: "7 etkinlik • 5 farklı mekan",
    variant: "city",
  },
  {
    id: "final",
    bg: "linear-gradient(135deg, #ec4899 0%, #7c3aed 50%, #1d4ed8 100%)",
    emoji: "✨",
    title: "Hadi devam edelim",
    bigText: "2026",
    subtitle: "daha çok etkinlik 🎉",
    variant: "final",
  },
];

const AUTOPLAY_MS = 5000;

/** ============== Component ============== */

export function WrappedSlides() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [direction, setDirection] = useState(1);
  const startX = useMotionValue(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = SLIDES.length;

  const go = useCallback(
    (next: number) => {
      const clamped = ((next % total) + total) % total;
      setDirection(clamped > index || (index === total - 1 && clamped === 0) ? 1 : -1);
      setIndex(clamped);
    },
    [index, total],
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Autoplay
  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % total);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, total]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slide = SLIDES[index];

  async function share() {
    const tweetText = encodeURIComponent(
      `2026'da MeydanFest ile 12 etkinliğe gittim, en sevdiğim kategori Konser oldu! 🎉 #MeydanFestWrapped`,
    );
    const url = typeof window !== "undefined" ? window.location.href : "https://meydanfest.com/yillik-ozet";
    const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(url)}`;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Yıllık Özetim — MeydanFest",
          text: "MeydanFest 2026 özetime bak!",
          url,
        });
        return;
      } catch {
        // fallthrough
      }
    }
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
    toast.success("Twitter penceresi açıldı");
  }

  function screenshot() {
    toast.info("Telefonda ekran görüntüsü almak için güç + ses düğmesine bas");
  }

  return (
    <div className="relative isolate h-[100svh] w-full overflow-hidden bg-black text-white select-none">
      {/* Slayt */}
      <AnimatePresence custom={direction} mode="wait" initial={false}>
        <motion.div
          key={slide.id}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 60 : -60, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: direction > 0 ? -60 : 60, scale: 0.98 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragStart={(_, info) => startX.set(info.point.x)}
          onDragEnd={(_, info) => {
            const delta = info.point.x - startX.get();
            if (delta < -60) next();
            else if (delta > 60) prev();
          }}
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: slide.bg }}
        >
          {/* Dekoratif blur'lu daireler */}
          <motion.div
            aria-hidden
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-32 -start-20 size-[480px] rounded-full bg-white/15 blur-3xl"
          />
          <motion.div
            aria-hidden
            animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-0 end-0 size-[420px] rounded-full bg-white/10 blur-3xl"
          />

          <SlideContent slide={slide} active />
        </motion.div>
      </AnimatePresence>

      {/* Üst bar: dot indicator + autoplay toggle */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 pt-4 sm:px-6">
        <div className="flex flex-1 items-center gap-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
              }}
              aria-label={`Slayt ${i + 1}`}
              className="group relative h-1 flex-1 overflow-hidden rounded-full bg-white/25"
            >
              <span
                className={
                  i < index
                    ? "block h-full w-full bg-white"
                    : i === index
                      ? "block h-full bg-white"
                      : "block h-full w-0 bg-white"
                }
                style={
                  i === index && playing
                    ? { width: "0%", animation: `wrapped-progress ${AUTOPLAY_MS}ms linear forwards` }
                    : undefined
                }
              />
              <style jsx>{`
                @keyframes wrapped-progress {
                  from { width: 0%; }
                  to   { width: 100%; }
                }
              `}</style>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Duraklat" : "Oynat"}
          className="ms-2 grid size-8 place-items-center rounded-full bg-white/20 backdrop-blur hover:bg-white/30 transition-colors"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
      </div>

      {/* Sağ/sol oklar (md+) */}
      <button
        type="button"
        onClick={prev}
        aria-label="Önceki slayt"
        className="absolute start-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 backdrop-blur hover:bg-white/25 transition-colors md:block"
      >
        <ChevronLeft className="size-5 rtl:rotate-180" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Sonraki slayt"
        className="absolute end-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 backdrop-blur hover:bg-white/25 transition-colors md:block"
      >
        <ChevronRight className="size-5 rtl:rotate-180" />
      </button>

      {/* Mobile tap areas (görünmez yarım yarım) */}
      <button
        type="button"
        onClick={prev}
        aria-label="Önceki slayt"
        className="absolute inset-y-0 start-0 z-10 w-1/3 md:hidden"
      />
      <button
        type="button"
        onClick={next}
        aria-label="Sonraki slayt"
        className="absolute inset-y-0 end-0 z-10 w-1/3 md:hidden"
      />

      {/* Alt bar: paylaş + screenshot ipucu */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 px-4 pb-6 sm:pb-8">
        <button
          type="button"
          onClick={screenshot}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-medium backdrop-blur hover:bg-white/25 transition-colors"
        >
          <Camera className="size-3.5" />
          Ekran görüntüsü
        </button>
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-full bg-white text-black px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Share2 className="size-3.5" />
          Twitter'da paylaş
        </button>
      </div>
    </div>
  );
}

/** ============== Slide content (variant'a göre) ============== */

function SlideContent({ slide, active }: { slide: Slide; active: boolean }) {
  return (
    <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="text-xs uppercase tracking-[0.25em] text-white/80"
      >
        {slide.title}
      </motion.div>

      <Hero variant={slide.variant} emoji={slide.emoji} bigText={slide.bigText} data={slide.data} active={active} />

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="mt-6 max-w-md text-lg sm:text-xl font-medium text-white/95"
      >
        {slide.subtitle}
      </motion.p>

      {slide.variant === "category" && slide.data && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8 grid grid-cols-3 gap-3"
        >
          <Stat icon={Music2} value={String(slide.data.konser)} label="Konser" />
          <Stat icon={PartyPopper} value={String(slide.data.festival)} label="Festival" />
          <Stat icon={Theater} value={String(slide.data.tiyatro)} label="Tiyatro" />
        </motion.div>
      )}

      {slide.variant === "buddy" && slide.data && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="mt-8 flex items-center gap-4 rounded-2xl bg-white/15 backdrop-blur px-5 py-3"
        >
          <span
            className="grid size-14 place-items-center rounded-2xl text-white text-xl font-bold shadow-lg"
            style={{ background: String(slide.data.color) }}
          >
            {String(slide.data.name).charAt(0)}
          </span>
          <div className="text-start">
            <div className="text-sm text-white/80">Buddy</div>
            <div className="font-semibold">{String(slide.data.name)}</div>
            <div className="text-xs text-white/70">{String(slide.data.count)} etkinlik birlikte</div>
          </div>
        </motion.div>
      )}

      {slide.variant === "city" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-4 py-2"
        >
          <MapPin className="size-4" />
          <span className="text-sm font-medium">7 etkinlik bu şehirde</span>
        </motion.div>
      )}

      {slide.variant === "final" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8"
        >
          <Link
            href="/etkinlikler"
            className="group inline-flex items-center gap-2 rounded-full bg-white text-black px-7 py-3.5 text-base font-semibold shadow-lg hover:opacity-95 transition-opacity"
          >
            <Sparkles className="size-5" />
            Yeni etkinlikler keşfet
            <ArrowRight className="size-4 rtl:rotate-180 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      )}
    </div>
  );
}

function Hero({
  variant,
  emoji,
  bigText,
  data,
  active,
}: {
  variant: Slide["variant"];
  emoji: string;
  bigText: string;
  data?: Slide["data"];
  active: boolean;
}) {
  // "particles" → emoji parçacık animasyonu
  const particles = useMemo(
    () => Array.from({ length: 14 }).map((_, i) => i),
    [],
  );

  return (
    <div className="relative mt-6 flex flex-col items-center">
      {/* Emoji */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.55, delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
        className="text-7xl sm:text-8xl"
        aria-hidden
      >
        {emoji}
      </motion.div>

      {/* Big text */}
      {variant === "hours" ? (
        <AnimatedHours active={active} target={Number((data?.hours as number) ?? 14.5)} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25 }}
          className="mt-3 text-6xl sm:text-8xl font-black tracking-tight leading-none"
        >
          {bigText}
        </motion.div>
      )}

      {/* Particles overlay */}
      {variant === "particles" && (
        <div className="pointer-events-none absolute inset-0 -z-0">
          {particles.map((i) => (
            <motion.span
              key={i}
              className="absolute text-2xl"
              style={{
                left: `${(i * 53) % 100}%`,
                top: `${(i * 37) % 100}%`,
              }}
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.6], y: [-10, -80, -120] }}
              transition={{ duration: 3.5, delay: i * 0.15, repeat: Infinity, ease: "easeOut" }}
              aria-hidden
            >
              {["🎉", "✨", "🎊", "🎈"][i % 4]}
            </motion.span>
          ))}
        </div>
      )}

      {variant === "category" && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.55, delay: 0.4, type: "spring", stiffness: 220, damping: 18 }}
          className="absolute -top-3 -end-3 grid size-12 place-items-center rounded-full bg-white/20 backdrop-blur"
        >
          <Music2 className="size-6" />
        </motion.span>
      )}

      {variant === "city" && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.4 }}
          className="absolute -top-3 -end-6 grid size-12 place-items-center rounded-full bg-white/20 backdrop-blur"
        >
          <MapPin className="size-6" />
        </motion.span>
      )}

      {variant === "buddy" && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.4 }}
          className="absolute -top-2 -end-4 grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur"
        >
          <Trophy className="size-5" />
        </motion.span>
      )}
    </div>
  );
}

function AnimatedHours({ active, target }: { active: boolean; target: number }) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1500;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Number((eased * target).toFixed(1)));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.25 }}
      className="mt-3 text-6xl sm:text-8xl font-black tracking-tight leading-none tabular-nums"
    >
      {val.toFixed(1)} saat
    </motion.div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Music2; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur px-4 py-3 text-center">
      <Icon className="mx-auto mb-1 size-5" aria-hidden />
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/80">{label}</div>
    </div>
  );
}
