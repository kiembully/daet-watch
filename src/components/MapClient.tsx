"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MapLegend } from "@/components/MapLegend";
import { MapView, type MapPoint } from "@/components/MapView";
import { useI18n } from "@/components/Providers";
import { CloseIcon, DropletIcon, PinIcon } from "@/components/icons";
import type { PublicIssue } from "@/lib/dto";
import { dayTone, waterIsStale } from "@/lib/rules";

export interface WaterPoint {
  id: string;
  name: string;
  type: string;
  barangay: string;
  status: "has_water" | "low" | "empty" | "unknown";
  lastConfirmedAt: string | null;
  location: { lat: number; lng: number };
}

const STATUS_TONE: Record<WaterPoint["status"], string> = {
  has_water: "bg-fixed text-fixed-ink",
  low: "bg-day-amber text-day-amber-ink",
  empty: "bg-day-red text-day-red-ink",
  unknown: "bg-surface-2 text-body",
};

export function MapClient({
  issues,
  water,
  focus,
}: {
  issues: PublicIssue[];
  water: WaterPoint[];
  focus?: { lat: number; lng: number; slug?: string };
}) {
  const { t } = useI18n();
  const [showIssues, setShowIssues] = useState(true);
  const [showWater, setShowWater] = useState(true);
  const [selected, setSelected] = useState<PublicIssue | null>(
    focus?.slug ? (issues.find((i) => i.slug === focus.slug) ?? null) : null,
  );
  const [selectedWater, setSelectedWater] = useState<WaterPoint | null>(null);

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = [];
    if (showIssues) {
      for (const issue of issues) {
        list.push({
          id: issue.id,
          lat: issue.location.lat,
          lng: issue.location.lng,
          tone: dayTone(issue.days),
          label: issue.title,
        });
      }
    }
    if (showWater) {
      for (const source of water) {
        list.push({
          id: `water-${source.id}`,
          lat: source.location.lat,
          lng: source.location.lng,
          tone: "water",
          label: source.name,
        });
      }
    }
    return list;
  }, [issues, showIssues, water, showWater]);

  return (
    <div className="relative">
      {/*
        The map lives in its OWN stacking context (`isolate`). Leaflet paints its
        panes at z-index 400–800, so without this every sibling overlay — the
        layer toggles, the legend, the pin preview — renders underneath the tiles
        and is invisible until a zoom forces a repaint.
      */}
      <div className="relative isolate z-0">
        <MapView
          points={points}
          center={focus ?? { lat: 14.10793, lng: 122.95393 }}
          zoom={focus ? 16 : 13}
          selectedId={selected?.id ?? (selectedWater ? `water-${selectedWater.id}` : null)}
          onPick={() => {
            // Tapping bare map dismisses the pin preview.
            setSelected(null);
            setSelectedWater(null);
          }}
          className="h-[calc(100dvh-8.5rem)] w-full"
          onSelect={(id) => {
            const issue = issues.find((i) => i.id === id);
            if (issue) {
              setSelectedWater(null);
              setSelected(issue);
              return;
            }
            const source = water.find((w) => `water-${w.id}` === id);
            if (source) {
              setSelected(null);
              setSelectedWater(source);
            }
          }}
        />
      </div>

      {/* layer toggles + legend, above the map's stacking context.
          Anchored top-RIGHT: Leaflet's own zoom control owns the top-left
          corner, and the chips used to sit on top of it. */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setShowIssues((v) => !v)}
          aria-pressed={showIssues}
          className={`press flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-bold shadow ${
            showIssues ? "border-ink bg-ink text-paper" : "border-line bg-surface text-body"
          }`}
        >
          <PinIcon size={14} /> {t.map.issues}
        </button>
        <button
          type="button"
          onClick={() => setShowWater((v) => !v)}
          aria-pressed={showWater}
          className={`press flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-bold shadow ${
            showWater ? "border-ink bg-ink text-paper" : "border-line bg-surface text-body"
          }`}
        >
          <DropletIcon size={14} /> {t.map.water}
        </button>
        <MapLegend />
      </div>

      {points.length === 0 ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-muted">
          {t.map.noIssues}
        </p>
      ) : null}

      {/* bottom sheet preview */}
      {selected ? (
        <div className="absolute inset-x-0 bottom-0 z-20">
          <div className="mx-2 mb-2 animate-[sheet-in_0.22s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl border border-line bg-surface p-3 shadow-xl">
            <div className="flex items-start gap-2">
              {selected.photos[0] ? (
                <img
                  src={selected.photos[0].url}
                  alt=""
                  className="size-20 shrink-0 rounded-xl object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold text-ink">{selected.title}</p>
                <p className="text-[11px] text-muted">
                  {selected.barangay?.name} · {selected.days} {t.issue.days} ·{" "}
                  {selected.confirmations} {t.feed.affected}
                </p>
                <Link
                  href={`/issue/${selected.slug}`}
                  className="press mt-2 inline-block rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-paper"
                >
                  {t.map.openIssue}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t.common.close}
                className="press grid size-8 place-items-center rounded-full bg-surface-2 text-body"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedWater ? (
        <div className="absolute inset-x-0 bottom-0 z-20">
          <div className="mx-2 mb-2 rounded-2xl border border-line bg-surface p-3 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-ink">{selectedWater.name}</p>
                <p className="text-[11px] text-muted">
                  {selectedWater.barangay} ·{" "}
                  {waterIsStale(selectedWater.lastConfirmedAt, new Date())
                    ? t.water.unconfirmed
                    : t.water.lastConfirmed.replace("{n}", "recently")}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${STATUS_TONE[selectedWater.status]}`}
              >
                {t.water[selectedWater.status === "has_water" ? "hasWater" : selectedWater.status]}
              </span>
            </div>
            <Link
              href="/water"
              className="press mt-2 inline-block rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-paper"
            >
              {t.water.reportStatus}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
