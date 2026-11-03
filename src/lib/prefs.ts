"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferences live in localStorage, read through useSyncExternalStore so the
 * server snapshot and the client snapshot can differ without React complaining
 * and without a setState-in-effect (which the React 19 lint rules reject).
 */

function store(key: string) {
  const listeners = new Set<() => void>();

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };

  const emit = () => listeners.forEach((l) => l());

  const read = (): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const write = (value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode — the UI still works, the choice just will not persist */
    }
    emit();
  };

  return { subscribe, read, write };
}

const stores = new Map<string, ReturnType<typeof store>>();

function getStore(key: string) {
  const existing = stores.get(key);
  if (existing) return existing;
  const created = store(key);
  stores.set(key, created);
  return created;
}

export function usePref<T extends string>(
  key: string,
  fallback: T,
): [T, (value: T) => void, boolean] {
  const s = getStore(key);

  const value = useSyncExternalStore(
    s.subscribe,
    () => s.read() ?? fallback,
    () => fallback,
  );

  // Hydration flag: the server snapshot is always the fallback, so anything that
  // must not flash has to wait one tick.
  const hydrated = useSyncExternalStore(
    s.subscribe,
    () => true,
    () => false,
  );

  const set = useCallback((next: T) => s.write(next), [s]);

  return [value as T, set, hydrated];
}

export const PREF_THEME = "dw-theme";
export const PREF_LOCALE = "dw-locale";
