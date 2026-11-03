"use client";

import { useState } from "react";

import { useI18n } from "@/components/Providers";
import { CloseIcon, DropletIcon, PlusIcon, SpinnerIcon } from "@/components/icons";
import { apiSend } from "@/lib/api-client";
import { hoursLabel } from "@/lib/format";
import { waterIsStale } from "@/lib/rules";
import type { WaterPoint } from "@/components/MapClient";
import type { WaterBoardRow } from "@/lib/queries";

const STATUS_STYLE: Record<WaterPoint["status"], string> = {
  has_water: "bg-fixed text-fixed-ink",
  low: "bg-day-amber text-day-amber-ink",
  empty: "bg-day-red text-day-red-ink",
  unknown: "bg-surface-2 text-body",
};

export function WaterClient({
  sources,
  board,
  barangays,
  signedIn,
}: {
  sources: WaterPoint[];
  board: WaterBoardRow[];
  barangays: { id: string; name: string }[];
  signedIn: boolean;
}) {
  const { t, tr, locale } = useI18n();

  const [rows, setRows] = useState(sources);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"truck" | "source" | null>(null);
  const [barangayId, setBarangayId] = useState("");
  const [note, setNote] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("deep_well");

  const reportStatus = async (source: WaterPoint, status: "has_water" | "low" | "empty") => {
    setBusy(source.id);
    try {
      const res = await apiSend<{ item: { lastConfirmedAt: string; status: WaterPoint["status"] } }>(
        `/api/water/sources/${source.id}/status`,
        "POST",
        { status },
      );
      setRows((prev) =>
        prev.map((row) =>
          row.id === source.id
            ? { ...row, status: res.item.status, lastConfirmedAt: res.item.lastConfirmedAt }
            : row,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const submitTruck = async () => {
    if (!barangayId) return;
    setBusy("truck");
    try {
      await apiSend("/api/water/trucks", "POST", {
        barangayId,
        note: note || undefined,
        spottedAt: new Date().toISOString(),
      });
      setSheet(null);
      setNote("");
      setMessage(t.water.truckSpotted);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const submitSource = async () => {
    if (!barangayId || sourceName.trim().length < 3) return;
    setBusy("source");
    try {
      await apiSend("/api/water/sources", "POST", {
        name: sourceName,
        type: sourceType,
        barangayId,
      });
      setSheet(null);
      setSourceName("");
      setMessage(t.water.addSource);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 px-3 pt-2">
      {message ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-body">{message}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSheet("truck")}
          className="press rounded-xl border border-line bg-surface p-3 text-left"
        >
          <DropletIcon size={18} />
          <p className="mt-1 text-sm font-bold text-ink">{t.water.truckSpotted}</p>
          <p className="text-[11px] text-muted">{t.water.truckHint}</p>
        </button>
        <button
          type="button"
          onClick={() => setSheet("source")}
          className="press rounded-xl border border-line bg-surface p-3 text-left"
        >
          <PlusIcon size={18} />
          <p className="mt-1 text-sm font-bold text-ink">{t.water.addSource}</p>
          <p className="text-[11px] text-muted">{t.water.sourceName}</p>
        </button>
      </div>

      {board.length > 0 ? (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            {t.water.leaderboard}
          </h2>
          <ol className="mt-2 space-y-1.5">
            {board.map((row) => (
              <li
                key={row.barangay}
                className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2"
              >
                <span className="text-sm font-semibold text-ink">{row.barangay}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="daynum text-xl font-black text-day-red">{row.days}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    {t.issue.days}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{t.map.water}</h2>
        <div className="mt-2 space-y-2">
          {rows.length === 0 ? (
            <p className="card p-3 text-sm text-muted">{t.water.noSources}</p>
          ) : null}
          {rows.map((source) => {
            const stale = waterIsStale(source.lastConfirmedAt, new Date());
            return (
              <div key={source.id} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{source.name}</p>
                    <p className="text-[11px] text-muted">
                      {source.barangay} · {t.water.types[source.type as keyof typeof t.water.types] ?? source.type}
                    </p>
                    <p className={`text-[11px] ${stale ? "text-day-red" : "text-muted"}`}>
                      {stale
                        ? t.water.unconfirmed
                        : tr(t.water.lastConfirmed, {
                            n: hoursLabel(
                              source.lastConfirmedAt ? hoursSince(source.lastConfirmedAt) : null,
                              locale,
                            ),
                          })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[source.status]}`}
                  >
                    {source.status === "has_water"
                      ? t.water.hasWater
                      : source.status === "low"
                        ? t.water.low
                        : source.status === "empty"
                          ? t.water.empty
                          : t.water.unknown}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["has_water", t.water.hasWater, "border-fixed text-fixed"],
                      ["low", t.water.low, "border-day-amber text-day-amber"],
                      ["empty", t.water.empty, "border-day-red text-day-red"],
                    ] as const
                  ).map(([status, label, style]) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => reportStatus(source, status)}
                      disabled={busy === source.id}
                      className={`press min-h-11 rounded-lg border bg-paper text-[11px] font-bold ${style}`}
                    >
                      {busy === source.id ? <SpinnerIcon size={12} /> : label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!signedIn ? (
        <p className="pb-2 text-center text-[11px] text-muted">{t.profile.signInHint}</p>
      ) : null}

      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={() => setSheet(null)}>
          <div
            onClick={(event) => event.stopPropagation()}
            className="mx-auto w-full max-w-[480px] animate-[sheet-in_0.22s_cubic-bezier(0.22,1,0.36,1)] rounded-t-3xl bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">
                {sheet === "truck" ? t.water.truckSpotted : t.water.addSource}
              </h2>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label={t.common.close}
                className="press grid size-9 place-items-center rounded-full bg-surface-2 text-body"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <select
              value={barangayId}
              onChange={(event) => setBarangayId(event.target.value)}
              className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-body"
            >
              <option value="">{t.report.barangay}</option>
              {barangays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {sheet === "source" ? (
              <>
                <input
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  placeholder={t.water.sourceName}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-body"
                />
                <select
                  value={sourceType}
                  onChange={(event) => setSourceType(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-body"
                >
                  {Object.entries(t.water.types).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t.water.truckHint}
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-body"
              />
            )}

            <button
              type="button"
              onClick={sheet === "truck" ? submitTruck : submitSource}
              disabled={busy !== null || !barangayId}
              className="press mt-3 min-h-12 w-full rounded-xl bg-ink text-sm font-bold text-paper disabled:opacity-40"
            >
              {busy ? <SpinnerIcon size={16} /> : t.common.save}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function hoursSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
}
