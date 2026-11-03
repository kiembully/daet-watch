"use client";

import { useEffect, useState } from "react";

import { ModHeader } from "@/components/headers";
import { useFeedback } from "@/components/Feedback";
import { useI18n } from "@/components/Providers";
import { DaysBadge } from "@/components/issue";
import { SpinnerIcon } from "@/components/icons";
import { apiGet, apiSend } from "@/lib/api-client";
import type { PublicIssue } from "@/lib/dto";
import { CATEGORIES, type Category } from "@/lib/rules";

interface FlaggedItem {
  issue: PublicIssue;
  flags: { id: string; reason: string; note: string | null; createdAt: string }[];
}

export function ModClient({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const { notify } = useFeedback();

  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [candidates, setCandidates] = useState<PublicIssue[]>([]);
  const [loading, setLoading] = useState(signedIn);
  const [busy, setBusy] = useState<string | null>(null);
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!signedIn) return;

    const load = async () => {
      try {
        const [flagged, open] = await Promise.all([
          apiGet<{ items: FlaggedItem[] }>("/api/mod/flagged"),
          apiGet<{ items: PublicIssue[] }>("/api/issues?sort=longest&limit=24&status=open"),
        ]);
        setItems(flagged.items);
        setCandidates(open.items);
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : t.common.error, { tone: "error" });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [signedIn, t.common.error, notify]);

  const act = async (slug: string, body: Record<string, unknown>) => {
    setBusy(slug);
    try {
      await apiSend(`/api/mod/${slug}`, "POST", body);
      if (body.action !== "recategorise") {
        setItems((prev) => prev.filter((item) => item.issue.slug !== slug));
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t.common.error, { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (!signedIn) {
    return (
      <>
        <ModHeader />
        <p className="p-6 text-center text-sm text-muted">{t.profile.signInHint}</p>
      </>
    );
  }

  return (
    <>
      <ModHeader />
      <div className="space-y-3 p-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{t.mod.flagged}</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <SpinnerIcon size={16} /> {t.common.loading}
          </div>
        ) : items.length === 0 ? (
          <p className="card p-4 text-sm text-muted">{t.mod.empty}</p>
        ) : null}

        {items.map(({ issue, flags }) => (
          <article key={issue.id} className="card p-3">
            <div className="flex items-start gap-2">
              {issue.photos[0] ? (
                <img
                  src={issue.photos[0].url}
                  alt=""
                  className="size-16 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold text-ink">{issue.title}</p>
                <p className="text-[11px] text-muted">
                  {issue.barangay?.name} · {issue.status} · {issue.flagCount} flags
                </p>
              </div>
              <DaysBadge days={issue.days} fixed={issue.status === "fixed"} daysToFix={issue.daysToFix} />
            </div>

            <ul className="mt-2 space-y-0.5">
              {flags.map((flag) => (
                <li key={flag.id} className="text-[11px] text-muted">
                  <span className="font-bold uppercase">{flag.reason}</span>
                  {flag.note ? ` — ${flag.note}` : ""}
                </li>
              ))}
            </ul>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => act(issue.slug, { action: "hide" })}
                disabled={busy !== null}
                className="press min-h-10 rounded-lg bg-ink text-xs font-bold text-paper"
              >
                {t.mod.hide}
              </button>
              <button
                type="button"
                onClick={() => act(issue.slug, { action: "unhide" })}
                disabled={busy !== null}
                className="press min-h-10 rounded-lg border border-line bg-surface text-xs font-bold text-body"
              >
                {t.mod.unhide}
              </button>
            </div>

            <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-1.5">
              <select
                value={mergeTargets[issue.id] ?? ""}
                onChange={(event) =>
                  setMergeTargets((prev) => ({ ...prev, [issue.id]: event.target.value }))
                }
                className="min-h-10 rounded-lg border border-line bg-surface px-2 text-xs text-body"
              >
                <option value="">{t.mod.mergeInto}</option>
                {candidates
                  .filter((candidate) => candidate.id !== issue.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title.slice(0, 48)}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  act(issue.slug, { action: "merge", targetId: mergeTargets[issue.id] })
                }
                disabled={busy !== null || !mergeTargets[issue.id]}
                className="press min-h-10 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-body disabled:opacity-40"
              >
                {t.mod.merge}
              </button>
            </div>

            <div className="mt-1.5">
              <select
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) {
                    void act(issue.slug, {
                      action: "recategorise",
                      category: event.target.value as Category,
                    });
                  }
                }}
                className="min-h-10 w-full rounded-lg border border-line bg-surface px-2 text-xs text-body"
              >
                <option value="">{t.mod.recategorise}</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t.categories[category]}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
