"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { fetchStoriesAction } from "@/lib/stories-actions";
import type { ActiveUserStrip } from "@/lib/stories-store";
import { StoryRing } from "./StoryRing";
import { StoryViewer } from "./StoryViewer";
import { AddStoryButton } from "./AddStoryButton";

interface StoryStripClientProps {
  initialUsers: ActiveUserStrip[];
  isLoggedIn: boolean;
  currentUserEmail: string | null;
  eventSlug?: string;
  eventTitle?: string;
}

const REFRESH_MS = 60_000;

export function StoryStripClient({
  initialUsers,
  isLoggedIn,
  currentUserEmail,
  eventSlug,
  eventTitle,
}: StoryStripClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);

  const refresh = useCallback(async () => {
    const next = await fetchStoriesAction({ eventSlug });
    setUsers(next);
  }, [eventSlug]);

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  function openAt(idx: number) {
    setViewerStart(idx);
    setViewerOpen(true);
  }

  function handleStoryRemoved() {
    refresh();
  }

  // Strip tamamen boş ve giriş yapmamışsa render etme
  if (users.length === 0 && !isLoggedIn) return null;

  return (
    <section
      aria-labelledby="story-strip-heading"
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h3 id="story-strip-heading" className="font-semibold leading-tight inline-flex items-center gap-1.5">
              <span aria-hidden>📸</span> Anlık Paylaşımlar
              <span className="text-xs font-normal text-[var(--muted)]">· 24sa</span>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {eventSlug ? "Bu etkinlikten kareler" : "Topluluktan canlı hikayeler"}
            </p>
          </div>
        </div>
        {isLoggedIn && users.length > 0 && (
          <AddStoryButton
            variant="compact"
            forcedEventSlug={eventSlug}
            forcedEventTitle={eventTitle}
            onAdded={refresh}
            label="Sen de paylaş →"
          />
        )}
      </header>

      <div className="-mx-1 overflow-x-auto">
        <div className="flex items-start gap-3 px-1 pb-1 min-w-max">
          {isLoggedIn && (
            <AddStoryButton
              variant="ring"
              forcedEventSlug={eventSlug}
              forcedEventTitle={eventTitle}
              onAdded={refresh}
            />
          )}

          {users.length === 0 ? (
            <div className="self-center text-xs text-[var(--muted)] px-3 py-6">
              Henüz hikaye yok. İlk paylaşan sen ol!
            </div>
          ) : (
            users.map((u, idx) => (
              <StoryRing
                key={u.email}
                name={u.name}
                avatarUrl={u.avatarUrl}
                color={u.color}
                hasUnviewed={u.hasUnviewed}
                onClick={() => openAt(idx)}
              />
            ))
          )}

          {!isLoggedIn && users.length > 0 && (
            <div className="self-center pl-2">
              <Link
                href="/giris"
                className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap"
              >
                Sen de paylaş →
              </Link>
            </div>
          )}
        </div>
      </div>

      <StoryViewer
        open={viewerOpen}
        userEmails={users.map((u) => u.email)}
        initialUserIndex={viewerStart}
        currentUserEmail={currentUserEmail}
        onClose={() => {
          setViewerOpen(false);
          refresh();
        }}
        onStoryRemoved={handleStoryRemoved}
      />
    </section>
  );
}
