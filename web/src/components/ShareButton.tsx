"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import {
  Share2,
  X,
  Link as LinkIcon,
  Mail,
  QrCode,
  Smartphone,
  Calendar,
  MapPin,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { playClick } from "@/lib/sounds";

interface ShareButtonProps {
  title: string;
  url: string;
  /** Etkinlik açıklaması — paylaşım mesajında kullanılır */
  description?: string;
  /** Paylaşım kartı önizlemesi için görsel URL'i */
  imageUrl?: string;
  city?: string;
  /** "5 Haziran 2026" gibi biçimlendirilmiş tarih */
  date?: string;
  className?: string;
  /** Geriye dönük uyumluluk — buton içinde yazı göster */
  withLabel?: boolean;
}

interface ChannelInfo {
  key: string;
  label: string;
  bg: string;
  icon: React.ReactNode;
  visible: boolean;
  action: () => void | Promise<void>;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function buildAbsoluteUrl(url: string): string {
  if (typeof window === "undefined") return url;
  return url.startsWith("http") ? url : window.location.origin + url;
}

// Marka renkleriyle inline SVG ikonları (lucide'da renkli marka yok)
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}
function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.962-.924c-.643-.204-.658-.643.136-.953l11.566-4.458c.535-.196 1.006.128.832.938z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647z" />
    </svg>
  );
}

export function ShareButton({
  title,
  url,
  description,
  imageUrl,
  city,
  date,
  className,
  withLabel = true,
}: ShareButtonProps) {
  const t = useTranslations("event");
  const [open, setOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      setHasNativeShare(true);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setShowQr(false);
    setCopied(false);
  }, []);

  // Escape + scroll lock
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  // QR yalnızca panel açıldığında üret
  useEffect(() => {
    if (!showQr || qrDataUrl) return;
    const absoluteUrl = buildAbsoluteUrl(url);
    QRCode.toDataURL(absoluteUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#0a0a0f", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => {
        toast.error("QR oluşturulamadı");
      });
  }, [showQr, qrDataUrl, url]);

  function openSheet(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    playClick();
    setOpen(true);
  }

  function buildMessages() {
    const absoluteUrl = buildAbsoluteUrl(url);
    const desc = description ? truncate(description, 200) : "";
    const locationLine = city ? `📍 ${city}${date ? ` — ${date}` : ""}` : date ? `📅 ${date}` : "";

    const longMsg = [
      `📅 ${title}`,
      locationLine,
      desc ? `\n${desc}` : "",
      `\n👉 ${absoluteUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Twitter ≤ 280 karakter. URL t.co tarafından 23 sayılır ama yine de kısa tutalım.
    const tweetSuffix = ` ${absoluteUrl}`;
    const maxTweetBody = 280 - tweetSuffix.length - 10; // "🎉 " ve emojiler için pay
    const tweetCore = [`🎉 ${title}`, date, city ? `— ${city}` : ""]
      .filter(Boolean)
      .join(" ");
    const tweetText =
      tweetCore.length > maxTweetBody ? truncate(tweetCore, maxTweetBody) : tweetCore;
    const tweetMsg = `${tweetText} Detaylar:${tweetSuffix}`;

    const emailSubject = `MeydanFest: ${title}`;
    const emailBody = `${title}\n${locationLine}\n\n${description ?? ""}\n\n${absoluteUrl}`;

    return { absoluteUrl, longMsg, tweetMsg, emailSubject, emailBody };
  }

  function openInPopup(href: string) {
    playClick();
    if (typeof window === "undefined") return;
    window.open(href, "_blank", "noopener,noreferrer,width=620,height=620");
    toast.success("Paylaşıldı ✓");
    setTimeout(close, 250);
  }

  async function copyLink() {
    playClick();
    const absoluteUrl = buildAbsoluteUrl(url);
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success("Link kopyalandı ✓");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Link kopyalanamadı");
    }
  }

  async function nativeShare() {
    playClick();
    const { absoluteUrl } = buildMessages();
    try {
      await navigator.share({
        title,
        text: description ?? title,
        url: absoluteUrl,
      });
      toast.success("Paylaşıldı ✓");
      close();
    } catch {
      // kullanıcı iptal etti — sessiz geç
    }
  }

  const { longMsg, tweetMsg, emailSubject, emailBody, absoluteUrl } = buildMessages();

  const channels: ChannelInfo[] = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      bg: "bg-[#25D366] text-white",
      icon: <WhatsAppIcon />,
      visible: true,
      action: () =>
        openInPopup(`https://wa.me/?text=${encodeURIComponent(longMsg)}`),
    },
    {
      key: "twitter",
      label: "X",
      bg: "bg-black text-white",
      icon: <TwitterIcon />,
      visible: true,
      action: () =>
        openInPopup(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetMsg)}`,
        ),
    },
    {
      key: "telegram",
      label: "Telegram",
      bg: "bg-[#229ED9] text-white",
      icon: <TelegramIcon />,
      visible: true,
      action: () =>
        openInPopup(
          `https://t.me/share/url?url=${encodeURIComponent(absoluteUrl)}&text=${encodeURIComponent(longMsg)}`,
        ),
    },
    {
      key: "facebook",
      label: "Facebook",
      bg: "bg-[#1877F2] text-white",
      icon: <FacebookIcon />,
      visible: true,
      action: () =>
        openInPopup(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl)}`,
        ),
    },
    {
      key: "email",
      label: "E-posta",
      bg: "bg-[var(--muted-bg)] text-[var(--foreground)]",
      icon: <Mail className="size-5" />,
      visible: true,
      action: () => {
        playClick();
        const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        if (typeof window !== "undefined") window.location.href = mailto;
        toast.success("E-posta açıldı");
        setTimeout(close, 250);
      },
    },
    {
      key: "copy",
      label: copied ? "Kopyalandı" : "Link Kopyala",
      bg: copied
        ? "bg-emerald-500 text-white"
        : "bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white",
      icon: copied ? <Check className="size-5" /> : <LinkIcon className="size-5" />,
      visible: true,
      action: copyLink,
    },
    {
      key: "qr",
      label: "QR Kod",
      bg: showQr
        ? "bg-[var(--primary)] text-white"
        : "bg-[var(--muted-bg)] text-[var(--foreground)]",
      icon: <QrCode className="size-5" />,
      visible: true,
      action: () => {
        playClick();
        setShowQr((v) => !v);
      },
    },
    {
      key: "native",
      label: "Sistem",
      bg: "bg-[var(--muted-bg)] text-[var(--foreground)]",
      icon: <Smartphone className="size-5" />,
      visible: hasNativeShare,
      action: nativeShare,
    },
  ];

  const visibleChannels = channels.filter((c) => c.visible);

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs hover:bg-[var(--muted-bg)] transition-colors",
          className,
        )}
        aria-label={t("share")}
      >
        <Share2 className="size-3.5" />
        {withLabel && t("share")}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm sm:p-4"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.5, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "100%", opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Etkinliği paylaş"
              className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
            >
              {/* Mobil drag handle */}
              <div className="sm:hidden flex justify-center pt-2 pb-1">
                <span className="h-1.5 w-10 rounded-full bg-[var(--border)]" />
              </div>

              <button
                type="button"
                onClick={close}
                aria-label="Kapat"
                className="absolute top-3 end-3 z-10 grid place-items-center size-8 rounded-full text-[var(--muted)] hover:bg-[var(--muted-bg)] hover:text-[var(--foreground)] transition-colors"
              >
                <X className="size-4" />
              </button>

              <div className="px-5 sm:px-6 pt-4 pb-2">
                <h3 className="text-base font-semibold tracking-tight">Etkinliği paylaş</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Arkadaşların da bu enerjiden haberdar olsun.
                </p>
              </div>

              {/* Önizleme kartı */}
              <div className="px-5 sm:px-6 pt-3">
                <div className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted-bg)] p-3">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-white">
                        <Share2 className="size-7 opacity-80" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      MeydanFest
                    </div>
                    <div className="font-semibold leading-snug line-clamp-2 text-sm">
                      {title}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
                      {city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {city}
                        </span>
                      )}
                      {date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" /> {date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Kanal grid */}
              <div className="px-5 sm:px-6 py-4">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {visibleChannels.map((c) => (
                    <motion.button
                      key={c.key}
                      type="button"
                      onClick={() => void c.action()}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ y: -2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      className="flex flex-col items-center gap-1.5 group"
                      aria-label={c.label}
                    >
                      <span
                        className={cn(
                          "grid size-12 place-items-center rounded-2xl shadow-sm transition-shadow group-hover:shadow-md",
                          c.bg,
                        )}
                      >
                        {c.icon}
                      </span>
                      <span className="text-[10px] sm:text-xs text-[var(--muted)] text-center leading-tight">
                        {c.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* QR paneli */}
              <AnimatePresence initial={false}>
                {showQr && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[var(--border)]"
                  >
                    <div className="flex flex-col items-center gap-3 px-5 sm:px-6 py-5">
                      <div className="rounded-2xl bg-white p-3 shadow-inner">
                        {qrDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrDataUrl}
                            alt="QR kod"
                            width={200}
                            height={200}
                            className="size-[200px] block"
                          />
                        ) : (
                          <div className="size-[200px] grid place-items-center text-xs text-neutral-500">
                            QR oluşturuluyor…
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted)] text-center max-w-xs">
                        Telefon kamerasıyla okutarak etkinliği aç.
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* URL göstergesi */}
              <div className="border-t border-[var(--border)] px-5 sm:px-6 py-3 flex items-center gap-2">
                <div
                  className="flex-1 truncate text-xs text-[var(--muted)] font-mono"
                  title={absoluteUrl}
                >
                  {absoluteUrl}
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[var(--muted-bg)] hover:bg-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  {copied ? <Check className="size-3.5" /> : <LinkIcon className="size-3.5" />}
                  {copied ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
