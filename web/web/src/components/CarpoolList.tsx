"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  MapPin,
  Clock,
  Users as UsersIcon,
  Plus,
  X,
  HandHelping,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { MOCK_USERS, type PublicUser } from "@/lib/social-data";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

type Tab = "drivers" | "riders";

interface DriverOffer {
  id: string;
  user: PublicUser;
  origin: string;
  seats: number;
  takenSeats: number;
  /** "Bugün 18:30" gibi serbest format */
  whenLabel: string;
  /** localStorage'dan geliyorsa true — silinebilir */
  mine?: boolean;
}

interface RiderRequest {
  id: string;
  user: PublicUser;
  origin: string;
}

interface StoredDriverOffer {
  id: string;
  origin: string;
  seats: number;
  takenSeats: number;
  whenLabel: string;
}

interface CarpoolListProps {
  eventSlug: string;
  eventTitle?: string;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return h;
}

const ORIGIN_POOL = [
  "Kadıköy",
  "Beşiktaş",
  "Şişli",
  "Beyoğlu",
  "Bakırköy",
  "Üsküdar",
  "Maltepe",
  "Levent",
  "Ataşehir",
  "Bahçelievler",
];

const WHEN_POOL = [
  "Bugün 18:30",
  "Bugün 19:00",
  "Yarın 17:45",
  "Cumartesi 20:15",
  "Pazar 16:00",
  "Cuma 18:00",
];

function pickFromPool<T>(pool: readonly T[], hash: number, offset: number): T {
  const idx = Math.abs(hash + offset * 9973) % pool.length;
  return pool[idx];
}

/** eventSlug'a deterministik 3 sürücü + 5 yolcu — her sayfa açılışı aynı kişiler */
function buildMockOffers(eventSlug: string): {
  drivers: DriverOffer[];
  riders: RiderRequest[];
} {
  const hash = hashCode(eventSlug);
  // 8 farklı index — collision olmadan
  const indices: number[] = [];
  const total = MOCK_USERS.length;
  for (let i = 0; i < 8; i++) {
    const idx = Math.abs(hash + i * 31) % total;
    if (!indices.includes(idx)) indices.push(idx);
  }
  // 8'i tamamla
  let extra = 0;
  while (indices.length < 8) {
    const idx = (indices[indices.length - 1] + 1 + extra) % total;
    if (!indices.includes(idx)) indices.push(idx);
    extra++;
  }

  const drivers: DriverOffer[] = indices.slice(0, 3).map((userIdx, i) => {
    const u = MOCK_USERS[userIdx];
    const seats = 2 + (Math.abs(hash + i * 7) % 3); // 2-4 koltuk
    const taken = Math.abs(hash + i * 11) % seats;
    return {
      id: `${eventSlug}-driver-${i}`,
      user: u,
      origin: pickFromPool(ORIGIN_POOL, hash, i),
      seats,
      takenSeats: taken,
      whenLabel: pickFromPool(WHEN_POOL, hash, i + 3),
    };
  });

  const riders: RiderRequest[] = indices.slice(3, 8).map((userIdx, i) => {
    const u = MOCK_USERS[userIdx];
    return {
      id: `${eventSlug}-rider-${i}`,
      user: u,
      origin: pickFromPool(ORIGIN_POOL, hash, i + 13),
    };
  });

  return { drivers, riders };
}

function lsKey(slug: string): string {
  return `es.carpools.${slug.toLowerCase()}`;
}

function readStoredOffers(slug: string): StoredDriverOffer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(lsKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredDriverOffer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredOffers(slug: string, offers: StoredDriverOffer[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(slug), JSON.stringify(offers));
  } catch {
    // ignore
  }
}

const SEAT_OPTIONS = [
  { value: "1", label: "1 koltuk boş" },
  { value: "2", label: "2 koltuk boş" },
  { value: "3", label: "3 koltuk boş" },
  { value: "4", label: "4 koltuk boş" },
];

const TIME_OPTIONS = [
  { value: "Bugün 17:00", label: "Bugün 17:00" },
  { value: "Bugün 18:00", label: "Bugün 18:00" },
  { value: "Bugün 19:00", label: "Bugün 19:00" },
  { value: "Bugün 20:00", label: "Bugün 20:00" },
  { value: "Yarın 17:00", label: "Yarın 17:00" },
  { value: "Yarın 18:00", label: "Yarın 18:00" },
  { value: "Yarın 19:00", label: "Yarın 19:00" },
  { value: "Yarın 20:00", label: "Yarın 20:00" },
];

const SELF_USER: PublicUser = {
  username: "you",
  name: "Sen",
  bio: "",
  color: "#7c3aed",
  followers: 0,
  following: 0,
  events: 0,
  igLinked: false,
  gender: "M",
  avatarUrl: "",
};

export function CarpoolList({ eventSlug }: CarpoolListProps) {
  const [tab, setTab] = useState<Tab>("drivers");
  const [modalOpen, setModalOpen] = useState(false);
  const [storedOffers, setStoredOffers] = useState<StoredDriverOffer[]>([]);

  // form state
  const [origin, setOrigin] = useState("");
  const [seats, setSeats] = useState("2");
  const [when, setWhen] = useState(TIME_OPTIONS[2].value);
  const [submitting, setSubmitting] = useState(false);

  const { drivers: seedDrivers, riders } = useMemo(
    () => buildMockOffers(eventSlug),
    [eventSlug],
  );

  useEffect(() => {
    setStoredOffers(readStoredOffers(eventSlug));
  }, [eventSlug]);

  // Esc ile kapanma
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const drivers: DriverOffer[] = useMemo(() => {
    const mine: DriverOffer[] = storedOffers.map((s) => ({
      id: s.id,
      user: SELF_USER,
      origin: s.origin,
      seats: s.seats,
      takenSeats: s.takenSeats,
      whenLabel: s.whenLabel,
      mine: true,
    }));
    return [...mine, ...seedDrivers];
  }, [storedOffers, seedDrivers]);

  function openModal() {
    setOrigin("");
    setSeats("2");
    setWhen(TIME_OPTIONS[2].value);
    setModalOpen(true);
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = origin.trim();
    if (!trimmed) {
      toast.error("Kalkış noktası gerekli");
      return;
    }
    setSubmitting(true);
    try {
      const next: StoredDriverOffer = {
        id: `${eventSlug}-mine-${Date.now()}`,
        origin: trimmed,
        seats: Number(seats),
        takenSeats: 0,
        whenLabel: when,
      };
      const all = [next, ...storedOffers];
      writeStoredOffers(eventSlug, all);
      setStoredOffers(all);
      setModalOpen(false);
      toast.success("Sürüş eklendi 🚗");
    } finally {
      setSubmitting(false);
    }
  }

  function removeOwn(id: string) {
    const all = storedOffers.filter((o) => o.id !== id);
    writeStoredOffers(eventSlug, all);
    setStoredOffers(all);
    toast.success("Sürüş kaldırıldı");
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Car className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold leading-tight">Birlikte gidiş</h3>
            <p className="text-xs text-[var(--muted)]">Sürücü ol veya birlikte git</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-xs font-semibold hover:opacity-95 transition-opacity glow-primary shrink-0"
        >
          <Plus className="size-3.5" />
          Sürüş paylaşıyorum
        </button>
      </header>

      <div role="tablist" className="flex gap-1 rounded-xl bg-[var(--muted-bg)] p-1 mb-4">
        <button
          role="tab"
          aria-selected={tab === "drivers"}
          onClick={() => setTab("drivers")}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "drivers"
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          Süren ({drivers.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === "riders"}
          onClick={() => setTab("riders")}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "riders"
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          İsteyen ({riders.length})
        </button>
      </div>

      {tab === "drivers" ? (
        <ul className="space-y-3">
          {drivers.length === 0 && (
            <li className="text-center text-sm text-[var(--muted)] py-6">
              Henüz sürücü yok. İlk sen ol!
            </li>
          )}
          {drivers.map((d) => {
            const remaining = Math.max(0, d.seats - d.takenSeats);
            return (
              <li
                key={d.id}
                className="rounded-2xl border border-[var(--border)] p-3 flex items-start gap-3"
              >
                <UserAvatar user={d.user} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.mine ? (
                      <span className="font-medium text-sm">{d.user.name}</span>
                    ) : (
                      <Link
                        href={`/profil/${d.user.username}`}
                        className="font-medium text-sm hover:text-[var(--primary)] transition-colors truncate"
                      >
                        {d.user.name}
                      </Link>
                    )}
                    {d.mine && (
                      <span className="rounded-full bg-[var(--primary)]/15 text-[var(--primary)] px-2 py-0.5 text-[10px] font-medium">
                        Sen
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" /> {d.origin}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" /> {d.whenLabel}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        remaining > 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
                      )}
                    >
                      <UsersIcon className="size-3.5" />
                      {remaining > 0 ? `boş yer ${remaining}` : "dolu"}
                    </span>
                  </div>
                </div>
                {d.mine ? (
                  <button
                    type="button"
                    onClick={() => removeOwn(d.id)}
                    aria-label="Sürüşü kaldır"
                    className="shrink-0 inline-flex items-center justify-center size-9 rounded-full text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <Link
                    href={`/mesaj/${d.user.username}`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--muted-bg)] text-[var(--foreground)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--primary)]/12 hover:text-[var(--primary)] transition-colors"
                  >
                    <MessageCircle className="size-3.5" />
                    İletişim
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-3">
          {riders.length === 0 && (
            <li className="text-center text-sm text-[var(--muted)] py-6">
              Şu an birlikte gitmek isteyen yok.
            </li>
          )}
          {riders.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3"
            >
              <UserAvatar user={r.user} size={40} />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profil/${r.user.username}`}
                  className="font-medium text-sm hover:text-[var(--primary)] transition-colors block truncate"
                >
                  {r.user.name}
                </Link>
                <div className="mt-0.5 text-xs text-[var(--muted)] inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {r.origin}
                </div>
              </div>
              <Link
                href={`/mesaj/${r.user.username}`}
                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--primary)]/20 transition-colors"
              >
                <HandHelping className="size-3.5" />
                Yardım et
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sürüş paylaş"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Car className="size-5" />
                  </span>
                  <h4 className="font-semibold">Sürüşünü paylaş</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Kapat"
                  className="inline-flex items-center justify-center size-9 rounded-full hover:bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="carpool-origin"
                    className="block text-xs font-medium text-[var(--muted)] mb-1.5"
                  >
                    Kalkış noktası
                  </label>
                  <input
                    id="carpool-origin"
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Örn: Kadıköy iskele"
                    required
                    maxLength={80}
                    className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-colors"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Boş yer"
                    value={seats}
                    onChange={setSeats}
                    options={SEAT_OPTIONS}
                  />
                  <Select
                    label="Saat"
                    value={when}
                    onChange={setWhen}
                    options={TIME_OPTIONS}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium hover:bg-[var(--muted-bg)] transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !origin.trim()}
                    className="flex-1 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] py-2.5 text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 disabled:pointer-events-none glow-primary"
                  >
                    Ekle
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function UserAvatar({ user, size = 40 }: { user: PublicUser; size?: number }) {
  // Map numeric px size to closest Tailwind size class (40px → size-10)
  const sizeClass = size <= 32 ? "size-8" : size <= 36 ? "size-9" : size <= 40 ? "size-10" : size <= 44 ? "size-11" : "size-12";
  return (
    <Avatar
      src={user.avatarUrl || undefined}
      name={user.name}
      color={user.color}
      size={sizeClass}
    />
  );
}
