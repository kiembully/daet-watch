"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/components/Providers";
import { CloseIcon, InfoIcon } from "@/components/icons";

/**
 * Pin legend.
 *
 * The modal is portalled to <body> on purpose: it lives inside the map's
 * wrapper, and Leaflet's panes carry z-index 400–800, so anything rendered in
 * that subtree is at the mercy of the map's stacking context.
 */
export function MapLegend() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const rows = [
    { key: "new", label: t.map.legendNew, swatch: <Dot colour="#5b6470" /> },
    { key: "aging", label: t.map.legendAging, swatch: <Dot colour="#f5b301" /> },
    { key: "critical", label: t.map.legendCritical, swatch: <Dot colour="#d92b1f" /> },
    { key: "fixed", label: t.map.legendFixed, swatch: <Dot colour="#087a4d" /> },
    { key: "water", label: t.map.legendWater, swatch: <Dot colour="#1d6fd0" /> },
    {
      key: "cluster",
      label: t.map.legendCluster,
      swatch: (
        <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-paper bg-ink text-[11px] font-bold text-paper">
          3
        </span>
      ),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="press flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-bold text-body shadow"
      >
        <InfoIcon size={14} /> {t.map.legend}
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-6"
              onClick={() => setOpen(false)}
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t.map.legendTitle}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-[320px] animate-[rise_0.18s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl border border-line bg-paper p-4 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold text-ink">{t.map.legendTitle}</h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t.common.close}
                    className="press -mr-1 -mt-1 grid size-8 place-items-center rounded-full bg-surface-2 text-body"
                  >
                    <CloseIcon size={16} />
                  </button>
                </div>

                <ul className="mt-3 space-y-2">
                  {rows.map((row) => (
                    <li key={row.key} className="flex items-center gap-3">
                      {row.swatch}
                      <span className="text-xs leading-snug text-body">{row.label}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="press mt-4 min-h-11 w-full rounded-xl bg-ink text-xs font-bold text-paper"
                >
                  {t.map.legendClose}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function Dot({ colour }: { colour: string }) {
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 rounded-full border-2 border-paper ring-1 ring-black/25 dark:border-surface dark:ring-white/30"
      style={{ backgroundColor: colour }}
    />
  );
}
