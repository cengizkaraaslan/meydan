"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { readProfile, type ProfileData } from "@/lib/profile-types";

type FieldKey = "city" | "birthDate" | "hobbies";

const FIELD_LABELS: Record<FieldKey, string> = {
  city: "şehirini",
  birthDate: "doğum tarihini",
  hobbies: "hobilerini",
};
const FIELD_VERB: Record<FieldKey, string> = {
  city: "şehrini",
  birthDate: "yaşını",
  hobbies: "hobilerini",
};

interface RevealableFieldProps {
  /** Hangi alan? Kullanıcının kendi profilinde dolu olup olmadığı kontrol edilir */
  field: FieldKey;
  /** İçerik — açıkken doğrudan, kilitliyken blur arkasında */
  children: React.ReactNode;
  /** Profil sahibinin alanının boş olup olmadığı — server'dan gelir.
   *  Profil sahibinde alan boşsa zaten gizlenecek (render edilmez) */
}

function isFilled(profile: ProfileData, field: FieldKey): boolean {
  if (field === "city") return Boolean(profile.city?.trim());
  if (field === "birthDate") return Boolean(profile.birthDate?.trim());
  if (field === "hobbies") return (profile.hobbies?.length ?? 0) > 0;
  return false;
}

/**
 * Karşılıklı erişim (reciprocity):
 * Kullanıcı kendi profilinde aynı alanı doldurmadıysa başkasının
 * bu alanını da göremez. Doldurmaya teşvik eder.
 *
 * Server tarafında okunamadığı için (localStorage), client tarafta
 * mount sonrası kontrol eder. SSR'da geçici olarak görünür durumda
 * render edilir; hidrasyon sonrası filtre uygulanır.
 */
export function RevealableField({ field, children }: RevealableFieldProps) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    const p = readProfile();
    setUnlocked(isFilled(p, field));
  }, [field]);

  // SSR + ilk render — flash önlemek için iskelet
  if (unlocked === null) {
    return (
      <div className="opacity-60 select-none pointer-events-none blur-sm">
        {children}
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative inline-block">
      <div className="blur-md opacity-60 select-none pointer-events-none">
        {children}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 grid place-items-center"
      >
        <Link
          href="/ayarlar/profil"
          title={`Görmek için kendi ${FIELD_VERB[field]} doldur`}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--card)]/95 backdrop-blur ring-1 ring-[var(--border)] px-3 py-1 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors shadow-sm"
        >
          <Lock className="size-3" />
          Görmek için {FIELD_LABELS[field]} doldur
          <ArrowRight className="size-3" />
        </Link>
      </motion.div>
    </div>
  );
}

/**
 * Tüm profilde "bilgilerini tamamla" üst banner — kullanıcı henüz hiçbir
 * alanı doldurmadıysa görünür ve hangi alanların eksik olduğunu söyler.
 */
export function ProfileCompletionBanner() {
  const [state, setState] = useState<{
    missing: FieldKey[];
    loaded: boolean;
  }>({ missing: [], loaded: false });

  useEffect(() => {
    const p = readProfile();
    const missing: FieldKey[] = [];
    if (!isFilled(p, "city")) missing.push("city");
    if (!isFilled(p, "birthDate")) missing.push("birthDate");
    if (!isFilled(p, "hobbies")) missing.push("hobbies");
    setState({ missing, loaded: true });
  }, []);

  return (
    <AnimatePresence>
      {state.loaded && state.missing.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-6 rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-r from-[var(--accent)]/8 to-[var(--primary)]/8 p-4"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)] shrink-0">
              <Lock className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Bilgileri görmek için kendi profilini tamamla</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                Eksik:{" "}
                {state.missing.map((f, i) => (
                  <span key={f}>
                    <strong className="text-[var(--foreground)]">{FIELD_VERB[f]}</strong>
                    {i < state.missing.length - 1 ? ", " : ""}
                  </span>
                ))}
                . Bunları doldurmadan başkalarınınkini göremezsin.
              </div>
              <Link
                href="/ayarlar/profil"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-xs font-semibold hover:opacity-95 transition-opacity"
              >
                Profilimi tamamla
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
