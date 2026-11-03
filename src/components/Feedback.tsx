"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/components/Providers";

/**
 * One small dialog for every server answer.
 *
 * The API already speaks in plain sentences ("Sign in to do that", "Too many
 * attempts…"), and those were being rendered as an inline <p> somewhere below
 * the fold. A resident tapped a button, nothing visible happened, and the reason
 * sat off-screen. Anything the server says now lands in a compact popup that is
 * portalled to <body> (so no map/card stacking context can bury it) and, when
 * the fix is "sign in", carries the button that actually does it.
 */

type Tone = "info" | "error" | "success";

interface NotifyOptions {
  tone?: Tone;
  /** Renders a primary button that runs this and closes the dialog. */
  actionLabel?: string;
  onAction?: () => void;
  /** 0 keeps the dialog until dismissed. Defaults to 5.2s without an action. */
  dismissAfterMs?: number;
}

interface Current extends NotifyOptions {
  id: number;
  text: string;
}

interface FeedbackValue {
  notify: (text: string, options?: NotifyOptions) => void;
  dismiss: () => void;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

const BAR: Record<Tone, string> = {
  info: "bg-ink",
  error: "bg-day-red",
  success: "bg-fixed",
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);

  const notify = useCallback((text: string, options: NotifyOptions = {}) => {
    setCurrent({ id: Date.now(), text, tone: "info", ...options });
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);

  const value = useMemo<FeedbackValue>(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {current ? <Dialog current={current} onDismiss={dismiss} /> : null}
    </FeedbackContext.Provider>
  );
}

function Dialog({ current, onDismiss }: { current: Current; onDismiss: () => void }) {
  const { t } = useI18n();
  const card = useRef<HTMLDivElement | null>(null);

  // Focus the card, not a button: a programmatic focus on the CTA paints a
  // focus ring on a control the resident has not chosen yet. Keyboard users can
  // still Tab straight into the buttons.
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  useEffect(() => {
    if (current.actionLabel) return;
    const ms = current.dismissAfterMs ?? 5200;
    if (ms <= 0) return;
    const timer = window.setTimeout(onDismiss, ms);
    return () => window.clearTimeout(timer);
  }, [current.actionLabel, current.dismissAfterMs, current.id, onDismiss]);

  const runAction = () => {
    const action = current.onAction;
    onDismiss();
    action?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-6"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        ref={card}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[320px] animate-[rise_0.16s_cubic-bezier(0.22,1,0.36,1)] overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl outline-none"
      >
        <div className={`h-1 w-full ${BAR[current.tone ?? "info"]}`} aria-hidden />
        <div className="p-4">
          <p className="whitespace-pre-line text-sm font-semibold leading-snug text-ink">
            {current.text}
          </p>

          <div className="mt-3 flex gap-2">
            {current.actionLabel ? (
              <button
                type="button"
                onClick={runAction}
                className="press min-h-11 flex-1 rounded-xl bg-ink text-xs font-bold text-paper"
              >
                {current.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDismiss}
              className={`press min-h-11 rounded-xl text-xs font-bold ${
                current.actionLabel
                  ? "flex-1 border border-line bg-surface text-body"
                  : "w-full bg-ink text-paper"
              }`}
            >
              {current.actionLabel ? t.common.close : t.common.ok}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}
