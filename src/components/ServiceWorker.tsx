"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and gives the offline draft queue a chance to
 * flush. Background Sync is Chromium-only, so `online` + visibility change are
 * the real fallback paths — iOS never fires a sync event.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;

        void import("@/lib/offline/queue").then(({ flushQueue }) => {
          void flushQueue();
          const onOnline = () => void flushQueue();
          const onVisible = () => {
            if (document.visibilityState === "visible") void flushQueue();
          };
          window.addEventListener("online", onOnline);
          document.addEventListener("visibilitychange", onVisible);
          navigator.serviceWorker.addEventListener("message", (event) => {
            if ((event.data as { type?: string })?.type === "sync-queue") void flushQueue();
          });

          if ("sync" in registration) {
            const sync = (registration as ServiceWorkerRegistration & {
              sync?: { register: (tag: string) => Promise<void> };
            }).sync;
            void sync?.register("daet-watch-flush").catch(() => undefined);
          }
        });
      } catch (error) {
        console.warn("[sw] registration failed", error);
      }
    };

    void register();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
