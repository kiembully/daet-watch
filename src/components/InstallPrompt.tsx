"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/Providers";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "dw-install-dismissed";

export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosSheet, setIosSheet] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Desktop visitors do not need an install banner, and showing it on first
    // paint covers the feed — which is the one thing a new visitor came for.
    if (navigator.maxTouchPoints === 0) return;

    let prompt: BeforeInstallPromptEvent | null = null;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      prompt = event as BeforeInstallPromptEvent;
      setDeferred(prompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const timer = window.setTimeout(() => setVisible(true), 18_000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
    setIosSheet(false);
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-[480px] px-3">
        <div className="card flex items-center gap-3 p-3 shadow-lg">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{t.profile.install}</p>
            <p className="text-xs text-muted">{t.profile.installHint}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (deferred) {
                void deferred.prompt();
                setVisible(false);
              } else {
                setIosSheet(true);
              }
            }}
            className="press rounded-full bg-ink px-3 py-2 text-xs font-bold text-paper"
          >
            {t.profile.install}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="press rounded-full px-2 py-2 text-xs font-semibold text-muted"
          >
            {t.profile.dismiss}
          </button>
        </div>
      </div>

      {iosSheet ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setIosSheet(false)}>
          <div
            className="mx-auto w-full max-w-[480px] animate-[sheet-in_0.22s_cubic-bezier(0.22,1,0.36,1)] rounded-t-3xl bg-paper p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold text-ink">{t.profile.install}</p>
            <p className="mt-2 text-sm text-body">{t.profile.installIos}</p>
            <button
              type="button"
              onClick={() => setIosSheet(false)}
              className="press mt-4 w-full rounded-xl bg-ink py-3 text-sm font-bold text-paper"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
