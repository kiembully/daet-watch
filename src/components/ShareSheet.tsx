"use client";

import { useState } from "react";

import { useI18n } from "@/components/Providers";
import { CloseIcon, ShareIcon, SpinnerIcon } from "@/components/icons";

const CHANNELS = [
  { key: "facebook", labelKey: "facebook", build: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { key: "messenger", labelKey: "messenger", build: (url: string) => `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(url)}` },
  { key: "x", labelKey: "x", build: (url: string, title: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
] as const;

/**
 * Share sheet. On a phone the primary path is the OS share sheet with the image
 * attached as a FILE — a link alone renders badly in Messenger. Everything else
 * is a fallback for desktop.
 */
export function ShareSheet({
  open,
  onClose,
  slug,
  title,
  days,
  fixed,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  title: string;
  days: number;
  fixed: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // The sheet only renders after a tap, so reading the origin here cannot differ
  // between the server render (which returns null further above) and the client.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const pageUrl = `${origin}/issue/${slug}`;
  const imageUrl = `${origin}/api/og/${slug}`;
  const headline = fixed ? `FIXED after ${days} days` : `DAY ${days} UNFIXED`;

  const log = (channel: string) => {
    void fetch(`/api/issues/${slug}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel }),
    }).catch(() => undefined);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      log("copy");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is visible in the sheet */
    }
  };

  const download = async () => {
    setBusy("download");
    try {
      log("download");
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${slug}-${fixed ? "fixed" : `day-${days}`}.png`;
      link.click();
      URL.revokeObjectURL(href);
    } finally {
      setBusy(null);
    }
  };

  const nativeShare = async () => {
    setBusy("native");
    try {
      log("native");
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], `${slug}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${headline} — ${title}`, url: pageUrl });
      } else if (navigator.share) {
        await navigator.share({ title, text: `${headline} — ${title}`, url: pageUrl });
      } else {
        await copy();
      }
    } catch {
      /* the user cancelled, or share is unavailable */
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.share.title}
        onClick={(event) => event.stopPropagation()}
        className="mx-auto w-full max-w-[480px] animate-[sheet-in_0.22s_cubic-bezier(0.22,1,0.36,1)] rounded-t-3xl bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">{t.share.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="press grid size-9 place-items-center rounded-full bg-surface-2 text-body"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
          <img src={imageUrl} alt="" className="aspect-[1200/630] w-full object-cover" />
          <p className="px-3 py-2 text-xs text-muted">{pageUrl}</p>
        </div>

        <button
          type="button"
          onClick={nativeShare}
          disabled={busy !== null}
          className="press mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-paper"
        >
          {busy === "native" ? <SpinnerIcon size={16} /> : <ShareIcon size={18} />}
          {t.share.native}
        </button>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {CHANNELS.map((channel) => (
            <a
              key={channel.key}
              href={channel.build(pageUrl, `${headline} — ${title}`)}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => log(channel.key)}
              className="press grid min-h-11 place-items-center rounded-xl border border-line bg-surface text-xs font-bold text-body"
            >
              {t.share[channel.labelKey]}
            </a>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copy}
            className="press min-h-11 rounded-xl border border-line bg-surface text-xs font-bold text-body"
          >
            {copied ? t.share.copied : t.share.copy}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={busy !== null}
            className="press min-h-11 rounded-xl border border-line bg-surface text-xs font-bold text-body"
          >
            {busy === "download" ? <SpinnerIcon size={14} /> : t.share.download}
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-muted">{t.issue.disclaimer}</p>
      </div>
    </div>
  );
}
