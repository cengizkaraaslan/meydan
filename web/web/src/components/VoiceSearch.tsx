"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "idle" | "listening" | "processing";

// Minimal SpeechRecognition typing — Web Speech API isn't in lib.dom yet.
type SRResultEvent = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SRErrorEvent = {
  error: string;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SRResultEvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SRConstructor = new () => SpeechRecognitionLike;

const LOCALE_TO_SR_LANG: Record<string, string> = {
  tr: "tr-TR",
  en: "en-US",
  ar: "ar-SA",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  ru: "ru-RU",
  it: "it-IT",
  zh: "zh-CN",
  ja: "ja-JP",
  pt: "pt-PT",
  fa: "fa-IR",
};

function getSpeechRecognitionCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceSearch({
  onResult,
  className,
}: {
  onResult: (text: string) => void;
  className?: string;
}) {
  const t = useTranslations("voice");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef<string>("");

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  function stop() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }

  function start() {
    if (status !== "idle") {
      stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast.error(t("unsupported"));
      return;
    }

    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      toast.error(t("unsupported"));
      return;
    }

    recognition.lang = LOCALE_TO_SR_LANG[locale] ?? "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    finalRef.current = "";
    setTranscript("");

    recognition.onstart = () => {
      setStatus("listening");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalText += text;
        } else {
          interim += text;
        }
      }
      if (finalText) finalRef.current += finalText;
      setTranscript(finalRef.current + interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error(t("denied"));
      } else if (event.error === "no-speech") {
        // silent — user didn't speak
      } else if (event.error !== "aborted") {
        toast.error(t("denied"));
      }
      setStatus("idle");
      setTranscript("");
    };

    recognition.onend = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const final = finalRef.current.trim();
      if (final) {
        setStatus("processing");
        // Short delay so the user sees the processing state visually
        setTimeout(() => {
          onResult(final);
          setStatus("idle");
          setTranscript("");
        }, 250);
      } else {
        setStatus("idle");
        setTranscript("");
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      timeoutRef.current = setTimeout(() => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }, 8000);
    } catch {
      setStatus("idle");
      recognitionRef.current = null;
    }
  }

  const disabled = supported === false;

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label={disabled ? t("unsupported") : t("start")}
        title={disabled ? t("unsupported") : t("start")}
        className={cn(
          "relative inline-flex items-center justify-center size-8 rounded-lg transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30",
          disabled && "opacity-40 cursor-not-allowed",
          !disabled && status === "idle" && "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]",
          !disabled && status === "listening" && "text-[var(--danger)] bg-[var(--danger)]/10",
          !disabled && status === "processing" && "text-[var(--primary)] bg-[var(--primary)]/10",
          className,
        )}
      >
        {status === "processing" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Mic className="size-4" />
        )}

        {status === "listening" && (
          <>
            <motion.span
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-0 rounded-lg bg-[var(--danger)]/40 pointer-events-none"
            />
            <motion.span
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
              className="absolute inset-0 rounded-lg bg-[var(--danger)]/30 pointer-events-none"
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {(status === "listening" || status === "processing") && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute end-0 top-full mt-2 z-50 min-w-[200px] max-w-[280px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl px-3 py-2 text-sm"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-1">
              <span className="relative inline-flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-[var(--danger)] opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--danger)]" />
              </span>
              {t("listen")}
            </div>
            <div className="text-[var(--foreground)] line-clamp-2 break-words min-h-[1.25rem]">
              {transcript || "…"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
