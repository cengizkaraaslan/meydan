"use client";

import { useEffect, useState } from "react";

interface SessionInfo {
  email: string | null;
  name: string | null;
  loading: boolean;
  isLoggedIn: boolean;
}

let _cache: { email: string | null; name: string | null } | null = null;
let _cacheAt = 0;
const TTL_MS = 30_000;

/**
 * NextAuth session bilgisini client'ten çeker (/api/auth/session).
 * 30 saniyelik bellek cache + tab odağında refresh.
 */
export function useClientSession(): SessionInfo {
  const [state, setState] = useState<SessionInfo>(() => ({
    email: _cache?.email ?? null,
    name: _cache?.name ?? null,
    loading: !_cache,
    isLoggedIn: !!_cache?.email,
  }));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = Date.now();
      if (_cache && now - _cacheAt < TTL_MS) {
        setState({
          email: _cache.email,
          name: _cache.name,
          loading: false,
          isLoggedIn: !!_cache.email,
        });
        return;
      }
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json()) as { user?: { email?: string | null; name?: string | null } };
        if (cancelled) return;
        _cache = {
          email: data?.user?.email ?? null,
          name: data?.user?.name ?? null,
        };
        _cacheAt = Date.now();
        setState({
          email: _cache.email,
          name: _cache.name,
          loading: false,
          isLoggedIn: !!_cache.email,
        });
      } catch {
        if (cancelled) return;
        setState({ email: null, name: null, loading: false, isLoggedIn: false });
      }
    }

    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return state;
}
