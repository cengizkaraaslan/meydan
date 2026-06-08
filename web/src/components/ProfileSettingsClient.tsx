"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, CheckCircle2, Sparkles, Eye, EyeOff, MapPin, Cake, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PhotoUpload } from "./PhotoUpload";
import { InstagramIcon } from "./icons/Social";
import { Select } from "./ui/Select";
import { CITIES } from "@/lib/types";
import { COUNTRIES } from "@/lib/countries";
import { calcAge } from "@/lib/social-data";

const LS_KEY = "es.profile";

interface ProfileData {
  username: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  instagram: string;
  instagramVisible: boolean;
  country: string; // İngilizce ülke adı (Ticketmaster uyumlu), örn. "Turkey"
  city: string;
  birthDate: string; // YYYY-MM-DD
  hobbies: string[];
  // Tanışma profili alanları (mobil ile aynı)
  showAge: boolean;
  heightCm: string;
  weightKg: string;
  goal: string;
  languages: string[];
  zodiac: string;
  education: string;
  drinking: string;
  smoking: string;
  exercise: string;
  interests: string[];
}

const DEFAULT: ProfileData = {
  username: "you",
  name: "Demo Kullanıcı",
  bio: "Etkinliğe arkadaşlarımla gitmeyi seviyorum.",
  avatarUrl: null,
  instagram: "",
  instagramVisible: false,
  country: "Turkey",
  city: "",
  birthDate: "",
  hobbies: [],
  showAge: true,
  heightCm: "",
  weightKg: "",
  goal: "",
  languages: [],
  zodiac: "",
  education: "",
  drinking: "",
  smoking: "",
  exercise: "",
  interests: [],
};

const GOAL_OPTIONS = ["Uzun ilişki", "Kısa süreli", "Etkinlik arkadaşı", "Arkadaşlık", "Henüz emin değilim"];
const LANGUAGE_OPTIONS = ["Türkçe", "İngilizce", "Almanca", "Fransızca", "İspanyolca", "İtalyanca", "Arapça", "Rusça"];
const ZODIAC_OPTIONS = ["Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak", "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"];
const EDUCATION_OPTIONS = ["Lise", "Ön lisans", "Üniversite", "Yüksek lisans", "Doktora"];
const DRINKING_OPTIONS = ["Hiç", "Sosyal içerim", "Sık sık"];
const SMOKING_OPTIONS = ["Hayır", "Bazen", "Evet"];
const EXERCISE_OPTIONS = ["Hiç", "Bazen", "Düzenli", "Her gün"];
const INTEREST_OPTIONS = [
  "Film", "Dizi", "Oyun", "Konser", "Tiyatro", "Müzik", "Spor", "Seyahat",
  "Kitap", "Yemek", "Dans", "Sanat", "Fotoğraf", "Doğa", "Kahve", "Festival",
  "Stand-up", "Teknoloji",
];

const POPULAR_HOBBIES = [
  "Konser", "Festival", "Sinema", "Tiyatro", "Sergi", "Dans", "Spor",
  "Yoga", "Doğa", "Kamp", "Bisiklet", "Fotoğraf", "Müzik", "Kitap",
  "Atölye", "Stand-up", "Jazz", "Rock", "Indie", "Klasik",
];

const MAX_HOBBIES = 8;

/** Instagram handle'ından @ ve URL parçalarını temizler */
function normalizeIgHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

const COLORS = ["#7c3aed", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#8b5cf6"];

interface Props {
  initialAuthName?: string | null;
  initialAuthImage?: string | null;
}

export function ProfileSettingsClient({ initialAuthName, initialAuthImage }: Props) {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  // "Yaşımı göster" açıkken kapatılmak istendiğinde onay modalını açar
  const [hideAgeConfirm, setHideAgeConfirm] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        setProfile({ ...DEFAULT, ...(JSON.parse(raw) as ProfileData) });
      } else if (initialAuthName) {
        setProfile({
          ...DEFAULT,
          name: initialAuthName,
          avatarUrl: initialAuthImage ?? null,
        });
      }
    } catch {
      // ignore
    }
  }, [initialAuthName, initialAuthImage]);

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  // "Yaşımı göster" toggle tıklaması:
  // - Kapalı → Açık: doğrudan aç (modal yok)
  // - Açık → Kapalı: önce onay modalı göster, kapatmayı erteleme
  function handleShowAgeToggle(next: boolean) {
    if (!next && profile.showAge) {
      setHideAgeConfirm(true);
      return;
    }
    update("showAge", next);
  }

  // Onay modalında "Tamam": yaşı gizle + localStorage'a yaz + modalı kapat.
  // (save() async setState'i beklemediği için showAge=false'u burada elle yazıyoruz)
  function confirmHideAge() {
    setProfile((p) => {
      const updated = { ...p, showAge: false };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setHideAgeConfirm(false);
    toast.success("Yaşın artık gizli");
  }

  function addHobby(raw: string) {
    const h = raw.trim().slice(0, 24);
    if (!h) return;
    if (profile.hobbies.includes(h)) {
      toast.message("Bu hobi zaten ekli");
      return;
    }
    if (profile.hobbies.length >= MAX_HOBBIES) {
      toast.error(`En fazla ${MAX_HOBBIES} hobi ekleyebilirsin`);
      return;
    }
    update("hobbies", [...profile.hobbies, h]);
  }

  function removeHobby(h: string) {
    update(
      "hobbies",
      profile.hobbies.filter((x) => x !== h),
    );
  }

  // Çoklu seçim: tıklayınca aç/kapat
  function toggleMulti(key: "languages" | "interests", value: string) {
    const list = profile[key];
    update(key, list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  // Tek seçim: tıklayınca seç, tekrar tıklayınca kaldır
  function toggleSingle(
    key: "goal" | "zodiac" | "education" | "drinking" | "smoking" | "exercise",
    value: string,
  ) {
    update(key, profile[key] === value ? "" : value);
  }

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(profile));
      toast.success("Profil güncellendi ✓");
    } catch {
      toast.error("Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) {
    return <div className="h-96 grid place-items-center text-[var(--muted)]">Yükleniyor…</div>;
  }

  const avatarColor = COLORS[(profile.name.charCodeAt(0) || 65) % COLORS.length];

  return (
    <div className="space-y-7">
      {/* Avatar */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          Profil Fotoğrafı
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <motion.div
              key={profile.avatarUrl ?? "default"}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative shrink-0"
            >
              {profile.avatarUrl ? (
                <span className="block size-28 rounded-3xl overflow-hidden shadow-lg ring-2 ring-[var(--primary)]/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                </span>
              ) : (
                <span
                  className="grid size-28 place-items-center rounded-3xl text-white text-4xl font-bold shadow-lg ring-2 ring-[var(--primary)]/20"
                  style={{ background: `linear-gradient(135deg, ${avatarColor}, color-mix(in oklch, ${avatarColor}, white 30%))` }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute -bottom-1 -end-1 inline-flex items-center gap-1 rounded-full bg-[var(--success)] text-white px-2 py-0.5 text-[10px] font-semibold shadow">
                <Sparkles className="size-2.5" /> aktif
              </span>
            </motion.div>

            <div className="flex-1 w-full">
              <PhotoUpload
                folder="profile"
                value={profile.avatarUrl}
                onChange={(url) => update("avatarUrl", url ?? null)}
                maxSizeMb={3}
                label="Yeni fotoğraf yükle (JPG/PNG/WebP, maks 3 MB)"
              />
              {profile.avatarUrl && (
                <button
                  type="button"
                  onClick={() => update("avatarUrl", null)}
                  className="mt-2 text-xs text-[var(--danger)] hover:underline"
                >
                  Fotoğrafı kaldır
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          Bilgilerin
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <Field label="İsim Soyisim" hint={`Bu isim profilinde ve mesajlarda görünür.`}>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => update("name", e.target.value)}
              maxLength={60}
              placeholder="Adın Soyadın"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </Field>

          <Field label="Kullanıcı Adı" hint="Profilin URL'sinde kullanılır: /profil/kullanici-adi">
            <div className="flex">
              <span className="grid place-items-center px-3 rounded-s-xl border border-[var(--border)] border-e-0 bg-[var(--muted-bg)] text-[var(--muted)] text-sm">@</span>
              <input
                type="text"
                value={profile.username}
                onChange={(e) => update("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                maxLength={20}
                placeholder="kullanici-adi"
                className="flex-1 rounded-e-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </Field>

          <Field label="Biyografi" hint={`${profile.bio.length}/160`}>
            <textarea
              value={profile.bio}
              onChange={(e) => update("bio", e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Kendinden bahset — nelerden hoşlanırsın?"
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </Field>
        </div>
      </section>

      {/* Sosyal Bağlantılar */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          Sosyal Bağlantılar
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <Field
            label="Instagram"
            hint="Etkinlikte buluşmak isteyenlerin sana ulaşması için"
          >
            <div className="flex items-stretch gap-2">
              <div className="flex-1 flex">
                <span className="grid place-items-center px-3 rounded-s-xl border border-[var(--border)] border-e-0 bg-gradient-to-br from-rose-500/10 via-fuchsia-500/10 to-amber-400/10 text-[var(--muted)]">
                  <InstagramIcon className="size-4" />
                </span>
                <input
                  type="text"
                  value={profile.instagram}
                  onChange={(e) => update("instagram", normalizeIgHandle(e.target.value))}
                  maxLength={30}
                  placeholder="@kullaniciadi — buddy'lerin Instagram'ından sana ulaşır"
                  className="flex-1 rounded-e-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>

              {/* Görünür / Görünmez toggle */}
              <motion.label
                whileTap={{ scale: 0.96 }}
                title={
                  profile.instagramVisible
                    ? "Şu an profilinde görünür — gizlemek için tıkla"
                    : "Şu an gizli — herkese göstermek için tıkla"
                }
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 cursor-pointer transition-colors select-none ${
                  profile.instagramVisible
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--muted-bg)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={profile.instagramVisible}
                  onChange={(e) =>
                    update("instagramVisible", e.target.checked)
                  }
                  className="sr-only"
                />
                {profile.instagramVisible ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
                <span className="text-xs font-medium hidden sm:inline">
                  {profile.instagramVisible ? "Görünür" : "Gizli"}
                </span>
              </motion.label>
            </div>
            {profile.instagram && profile.instagramVisible && (
              <div className="mt-2 text-[11px] text-[var(--muted)] inline-flex items-center gap-1">
                <Eye className="size-3" />
                Önizleme: <strong className="text-[var(--foreground)]">@{profile.instagram}</strong>{" "}
                profilinde rozet olarak görünüyor
              </div>
            )}
            {profile.instagram && !profile.instagramVisible && (
              <div className="mt-2 text-[11px] text-[var(--muted)] inline-flex items-center gap-1">
                <EyeOff className="size-3" />
                Instagram'ın kayıtlı ama profilinde görünmüyor
              </div>
            )}
          </Field>
        </div>
      </section>

      {/* Konum + Doğum */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          Konum & Yaş
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <Field label="Ülke" hint="Profilinde görünür ve etkinlik filtrelerinde kullanılır">
            <div className="flex items-stretch gap-2">
              <span className="grid place-items-center px-3 rounded-s-xl border border-[var(--border)] border-e-0 bg-[var(--primary)]/10 text-[var(--primary)]">
                <MapPin className="size-4" />
              </span>
              <div className="flex-1">
                <Select
                  value={profile.country}
                  onChange={(v) => update("country", v)}
                  options={COUNTRIES.map((c) => ({
                    value: c.name,
                    label: `${c.flag} ${c.tr}`,
                  }))}
                  className="!rounded-s-none"
                />
              </div>
            </div>
          </Field>

          <Field label="Şehir" hint="Profilinde görünür ve etkinlik filtrelerinde kullanılır">
            <div className="flex items-stretch gap-2">
              <span className="grid place-items-center px-3 rounded-s-xl border border-[var(--border)] border-e-0 bg-[var(--primary)]/10 text-[var(--primary)]">
                <MapPin className="size-4" />
              </span>
              <div className="flex-1">
                <Select
                  value={profile.city}
                  onChange={(v) => update("city", v)}
                  options={[
                    { value: "", label: "Seçilmedi" },
                    ...CITIES.map((c) => ({ value: c, label: c })),
                  ]}
                  className="!rounded-s-none"
                />
              </div>
            </div>
          </Field>

          <Field
            label="Doğum Tarihi"
            hint={profile.birthDate ? `${calcAge(profile.birthDate)} yaşındasın` : "Sadece yaş gösterilir, tam tarih başkalarına gözükmez"}
          >
            <div className="flex items-stretch gap-2">
              <span className="grid place-items-center px-3 rounded-s-xl border border-[var(--border)] border-e-0 bg-[var(--accent)]/10 text-[var(--accent)]">
                <Cake className="size-4" />
              </span>
              <input
                type="date"
                value={profile.birthDate}
                onChange={(e) => update("birthDate", e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                min="1925-01-01"
                className="flex-1 rounded-e-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />

              {/* Yaşımı göster toggle */}
              <motion.label
                whileTap={{ scale: 0.96 }}
                title={
                  profile.showAge
                    ? "Yaşın profilinde görünür — gizlemek için tıkla"
                    : "Yaşın gizli — göstermek için tıkla"
                }
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 cursor-pointer transition-colors select-none ${
                  profile.showAge
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--muted-bg)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={profile.showAge}
                  onChange={(e) => handleShowAgeToggle(e.target.checked)}
                  className="sr-only"
                />
                {profile.showAge ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                <span className="text-xs font-medium hidden sm:inline">
                  {profile.showAge ? "Yaşım görünür" : "Yaşım gizli"}
                </span>
              </motion.label>
            </div>
          </Field>
        </div>
      </section>

      {/* Hobiler */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          Hobiler
          <span className="ms-2 text-[10px] normal-case font-normal">
            ({profile.hobbies.length}/{MAX_HOBBIES})
          </span>
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <HobbiesEditor
            hobbies={profile.hobbies}
            onAdd={addHobby}
            onRemove={removeHobby}
            maxCount={MAX_HOBBIES}
          />
        </div>
      </section>

      {/* Fiziksel & İlişki */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          Tanışma Profili
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Boy (cm)" hint="İsteğe bağlı">
              <input
                type="number"
                inputMode="numeric"
                value={profile.heightCm}
                onChange={(e) => update("heightCm", e.target.value)}
                min={100}
                max={250}
                placeholder="175"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </Field>
            <Field label="Kilo (kg)" hint="İsteğe bağlı">
              <input
                type="number"
                inputMode="numeric"
                value={profile.weightKg}
                onChange={(e) => update("weightKg", e.target.value)}
                min={30}
                max={250}
                placeholder="70"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </Field>
          </div>

          <Field label="İlişki Hedefi" hint="Tek seçim">
            <ChipSelect
              options={GOAL_OPTIONS}
              selected={profile.goal ? [profile.goal] : []}
              onToggle={(v) => toggleSingle("goal", v)}
            />
          </Field>

          <Field label="Bildiğim Diller" hint="Çoklu seçim">
            <ChipSelect
              options={LANGUAGE_OPTIONS}
              selected={profile.languages}
              onToggle={(v) => toggleMulti("languages", v)}
            />
          </Field>

          <Field label="Burç" hint="Tek seçim">
            <ChipSelect
              options={ZODIAC_OPTIONS}
              selected={profile.zodiac ? [profile.zodiac] : []}
              onToggle={(v) => toggleSingle("zodiac", v)}
            />
          </Field>

          <Field label="Eğitim" hint="Tek seçim">
            <ChipSelect
              options={EDUCATION_OPTIONS}
              selected={profile.education ? [profile.education] : []}
              onToggle={(v) => toggleSingle("education", v)}
            />
          </Field>
        </div>
      </section>

      {/* Yaşam Tarzı */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          Yaşam Tarzı
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
          <Field label="İçki" hint="Tek seçim">
            <ChipSelect
              options={DRINKING_OPTIONS}
              selected={profile.drinking ? [profile.drinking] : []}
              onToggle={(v) => toggleSingle("drinking", v)}
            />
          </Field>

          <Field label="Sigara" hint="Tek seçim">
            <ChipSelect
              options={SMOKING_OPTIONS}
              selected={profile.smoking ? [profile.smoking] : []}
              onToggle={(v) => toggleSingle("smoking", v)}
            />
          </Field>

          <Field label="Egzersiz" hint="Tek seçim">
            <ChipSelect
              options={EXERCISE_OPTIONS}
              selected={profile.exercise ? [profile.exercise] : []}
              onToggle={(v) => toggleSingle("exercise", v)}
            />
          </Field>
        </div>
      </section>

      {/* İlgi Alanları */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
          İlgi Alanları
          <span className="ms-2 text-[10px] normal-case font-normal">
            ({profile.interests.length} seçili)
          </span>
        </h2>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <ChipSelect
            options={INTEREST_OPTIONS}
            selected={profile.interests}
            onToggle={(v) => toggleMulti("interests", v)}
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 sticky bottom-4">
        <motion.button
          type="button"
          onClick={save}
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-3 text-sm font-semibold shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50 glow-primary"
        >
          {saving ? (
            <>
              <CheckCircle2 className="size-4 animate-pulse" /> Kaydediliyor…
            </>
          ) : (
            <>
              <Save className="size-4" /> Değişiklikleri Kaydet
            </>
          )}
        </motion.button>
      </div>

      {/* "Yaşını gizle?" onay modalı — açıkken kapatmaya çalışınca gösterilir */}
      <AnimatePresence>
        {hideAgeConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setHideAgeConfirm(false)}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/55 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Yaşını gizle?"
              className="relative w-full max-w-sm rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
            >
              <div className="relative p-6 text-center">
                <motion.div
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-xl mb-4"
                >
                  <EyeOff className="size-7" />
                </motion.div>

                <h2 className="text-lg font-bold tracking-tight">Yaşını gizle?</h2>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                  Yaşını gizlersen sen de başkalarının yaşını göremezsin.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHideAgeConfirm(false)}
                    className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] text-[var(--foreground)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={confirmHideAge}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-white px-4 py-2.5 text-sm font-semibold shadow-lg hover:opacity-95 transition-opacity"
                  >
                    Tamam
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium text-[var(--foreground)]">{label}</label>
        {hint && <span className="text-[10px] text-[var(--muted)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Çoklu veya tek seçimlik chip listesi. Seçim durumunu üst bileşen yönetir. */
function ChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/25"
                : "border border-dashed border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

interface HobbiesEditorProps {
  hobbies: string[];
  onAdd: (h: string) => void;
  onRemove: (h: string) => void;
  maxCount: number;
}

function HobbiesEditor({ hobbies, onAdd, onRemove, maxCount }: HobbiesEditorProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submitInput(e?: React.KeyboardEvent | React.MouseEvent) {
    e?.preventDefault();
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput("");
    inputRef.current?.focus();
  }

  const suggested = POPULAR_HOBBIES.filter((h) => !hobbies.includes(h)).slice(0, 10);

  return (
    <div className="space-y-3">
      {/* Mevcut chip'ler */}
      <AnimatePresence initial={false}>
        {hobbies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5 overflow-hidden"
          >
            {hobbies.map((h) => (
              <motion.span
                key={h}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/25 ps-3 pe-1 py-1 text-xs font-medium"
              >
                {h}
                <button
                  type="button"
                  onClick={() => onRemove(h)}
                  aria-label={`${h} kaldır`}
                  className="grid place-items-center size-5 rounded-full hover:bg-[var(--primary)]/15"
                >
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input + ekle butonu */}
      {hobbies.length < maxCount && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitInput(e);
              if (e.key === "," && input.trim()) submitInput(e);
            }}
            maxLength={24}
            placeholder="Hobini yaz, Enter'a bas... (örn: Yoga)"
            className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={submitInput}
            disabled={!input.trim()}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-2 text-sm font-medium hover:opacity-95 disabled:opacity-40 transition-opacity"
          >
            <Plus className="size-4" />
            Ekle
          </button>
        </div>
      )}

      {/* Popüler öneri */}
      {suggested.length > 0 && hobbies.length < maxCount && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1.5">
            Popüler
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAdd(s)}
                className="rounded-full border border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 hover:text-[var(--primary)] px-3 py-1 text-xs transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
