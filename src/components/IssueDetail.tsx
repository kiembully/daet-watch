"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DaysBadge, StatusPill } from "@/components/issue";
import { ShareSheet } from "@/components/ShareSheet";
import { useI18n } from "@/components/Providers";
import { CameraIcon, CheckIcon, FlagIcon, PinIcon, ShareIcon, SpinnerIcon } from "@/components/icons";
import { apiSend } from "@/lib/api-client";
import type { PublicIssue } from "@/lib/dto";
import { compressToDraftPhoto } from "@/lib/image";
import { uploadPhoto } from "@/lib/offline/queue";
import { canReopen, fixProgress, milestoneFor, OPEN_STATUSES } from "@/lib/rules";
import type { TimelineEntry } from "@/lib/queries";

interface Viewer {
  confirmed: boolean;
  fixVoted: boolean;
  reopenVoted: boolean;
  flagged: boolean;
}

interface Props {
  issue: PublicIssue;
  timeline: TimelineEntry[];
  viewer: Viewer;
  signedIn: boolean;
}

export function IssueDetail({ issue, timeline, viewer, signedIn }: Props) {
  const { t, tr, locale } = useI18n();
  const router = useRouter();

  const [confirmations, setConfirmations] = useState(issue.confirmations);
  const [confirmed, setConfirmed] = useState(viewer.confirmed);
  const [fixVotes, setFixVotes] = useState(issue.fixVotes);
  const [status, setStatus] = useState(issue.status);
  const [fixedAt, setFixedAt] = useState(issue.fixedAt);
  const [entries, setEntries] = useState(timeline);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [flagged, setFlagged] = useState(viewer.flagged);
  const [photoIndex, setPhotoIndex] = useState(0);

  const [updateText, setUpdateText] = useState("");
  const [updatePhoto, setUpdatePhoto] = useState<string | null>(null);

  const progress = fixProgress(fixVotes, issue.fixThreshold);
  const open = (OPEN_STATUSES as readonly string[]).includes(status);
  const reopenable = canReopen(fixedAt, status, new Date());
  const milestone = useMemo(() => milestoneFor(issue.days), [issue.days]);

  const requireSignIn = () => {
    router.push(`/login?next=${encodeURIComponent(`/issue/${issue.slug}`)}`);
  };

  const meToo = async () => {
    if (!signedIn) return requireSignIn();
    setBusy("confirm");
    try {
      const res = await apiSend<{ item: { confirmations: number; alreadyConfirmed: boolean } }>(
        `/api/issues/${issue.slug}/confirm`,
        "POST",
        {},
      );
      setConfirmations(res.item.confirmations);
      setConfirmed(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const markFixed = async () => {
    if (!signedIn) return requireSignIn();
    setBusy("fix");
    try {
      const res = await apiSend<{
        item: {
          fixVotes: number;
          status: string;
          fixedAt?: string;
          alreadyVoted: boolean;
          progress: { votes: number; target: number };
        };
      }>(`/api/issues/${issue.slug}/fix-vote`, "POST", {});
      setFixVotes(res.item.fixVotes);
      setStatus(res.item.status as PublicIssue["status"]);
      if (res.item.status === "fixed") {
        setFixedAt(res.item.fixedAt ?? new Date().toISOString());
        setMessage(tr(t.issue.fixProgress, { n: res.item.progress.target, target: res.item.progress.target }));
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const reopen = async () => {
    if (!signedIn) return requireSignIn();
    const reason = window.prompt(t.issue.reopenReason)?.trim();
    if (!reason || reason.length < 10) return;
    setBusy("reopen");
    try {
      const res = await apiSend<{ item: { status: string; votes: number; threshold: number } }>(
        `/api/issues/${issue.slug}/reopen`,
        "POST",
        { reason },
      );
      setStatus(res.item.status as PublicIssue["status"]);
      setMessage(
        res.item.status === "reopened"
          ? t.issue.statusReopened
          : tr(t.issue.fixProgress, { n: res.item.votes, target: res.item.threshold }),
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const flag = async () => {
    if (!signedIn) return requireSignIn();
    if (flagged) return;
    setBusy("flag");
    try {
      await apiSend(`/api/issues/${issue.slug}/flag`, "POST", { reason: "spam" });
      setFlagged(true);
      setMessage(t.issue.flagged);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const attachPhoto = async (file: File) => {
    setBusy("photo");
    try {
      const draft = await compressToDraftPhoto(file);
      const uploaded = await uploadPhoto(draft);
      setUpdatePhoto(uploaded.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const postUpdate = async () => {
    if (!signedIn) return requireSignIn();
    if (!updateText.trim() && !updatePhoto) return;
    setBusy("update");
    try {
      const res = await apiSend<{ item: TimelineEntry }>(
        `/api/issues/${issue.slug}/updates`,
        "POST",
        { text: updateText, photos: updatePhoto ? [{ url: updatePhoto, width: 1200, height: 900 }] : [] },
      );
      setEntries((prev) => [...prev, res.item]);
      setUpdateText("");
      setUpdatePhoto(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const photos = issue.photos;

  return (
    <div className="pb-6">
      {/* photo carousel */}
      <div className="relative">
        <div
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(event) => {
            const el = event.currentTarget;
            setPhotoIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {photos.length > 0 ? (
            photos.map((photo, index) => (
              <div key={photo.url + index} className="aspect-[4/3] w-full shrink-0 snap-center bg-surface-2">
                <img
                  src={photo.url}
                  alt={`${issue.title} — photo ${index + 1}`}
                  width={photo.width}
                  height={photo.height}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="size-full object-cover"
                />
              </div>
            ))
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center bg-surface-2 text-sm text-muted">
              {t.issue.photoRequired}
            </div>
          )}
        </div>

        {photos.length > 1 ? (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {photos.map((photo, index) => (
              <span
                key={photo.url + index}
                className={`size-1.5 rounded-full ${index === photoIndex ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        ) : null}

        <div className="absolute right-2 top-[calc(env(safe-area-inset-top)+0.5rem)] flex gap-2">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label={t.issue.share}
            className="press grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
          >
            <ShareIcon size={20} />
          </button>
        </div>
      </div>

      <div className="-mt-3 rounded-t-3xl bg-paper px-3 pt-3">
        {/* hero counter */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <DaysBadge
              days={issue.days}
              fixed={status === "fixed"}
              daysToFix={issue.daysToFix}
              variant="hero"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={status} />
          <span className="chip">{t.categories[issue.category]}</span>
          {issue.barangay ? (
            <Link href={`/?barangay=${issue.barangay.id}`} className="chip">
              <PinIcon size={12} />
              {issue.barangay.name}
            </Link>
          ) : null}
        </div>

        <h1 className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight text-ink">
          {issue.title}
        </h1>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-body">{issue.description}</p>

        {issue.waterDetails ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="card p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                {t.report.waterStarted}
              </p>
              <p className="text-sm font-semibold text-ink">
                {issue.waterDetails.outageStartedAt
                  ? new Date(issue.waterDetails.outageStartedAt).toLocaleDateString(
                      locale === "fil" ? "fil-PH" : "en-PH",
                      { day: "numeric", month: "short", timeZone: "Asia/Manila" },
                    )
                  : "—"}
              </p>
            </div>
            <div className="card p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                {t.report.households}
              </p>
              <p className="text-sm font-semibold text-ink">
                {issue.waterDetails.householdsAffectedEstimate ?? "—"}
              </p>
            </div>
          </div>
        ) : null}

        {issue.addressText ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <PinIcon size={14} />
            {issue.addressText}
          </p>
        ) : null}

        <p className="mt-2 text-xs text-muted">
          {t.issue.reportedBy}: {issue.reporter.displayName} · {issue.days} {t.issue.days}
          {status === "reopened" && issue.reopenCount > 0
            ? ` · ${tr(t.issue.reopenedAfter, { n: issue.reopenCount * 7 })}`
            : ""}
        </p>

        {/* actions */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={meToo}
            disabled={confirmed || !open || busy !== null}
            className={`press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold ${
              confirmed
                ? "bg-surface-2 text-muted"
                : "bg-ink text-paper disabled:opacity-60"
            }`}
          >
            {busy === "confirm" ? <SpinnerIcon size={16} /> : <CheckIcon size={18} />}
            {confirmed ? t.issue.confirmed : t.issue.confirm}
            {confirmations > 0 ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                {tr(t.issue.neighborsAffected, { n: confirmations })}
              </span>
            ) : null}
          </button>

          {open ? (
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-body">
                <span>{tr(t.issue.fixProgress, { n: progress.votes, target: progress.target })}</span>
                <span className="text-muted">
                  {progress.remaining === 0 ? t.issue.statusFixed : tr(t.issue.fixVoteOpen, { n: progress.remaining })}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-fixed transition-[width]"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
              <button
                type="button"
                onClick={markFixed}
                disabled={viewer.fixVoted || busy !== null}
                className="press mt-3 min-h-11 w-full rounded-lg bg-fixed text-sm font-bold text-fixed-ink disabled:opacity-60"
              >
                {busy === "fix" ? <SpinnerIcon size={16} /> : t.issue.markFixed}
              </button>
            </div>
          ) : null}

          {reopenable ? (
            <button
              type="button"
              onClick={reopen}
              disabled={busy !== null}
              className="press min-h-11 w-full rounded-xl border border-day-red/40 bg-day-red/10 text-sm font-bold text-day-red"
            >
              {busy === "reopen" ? <SpinnerIcon size={16} /> : t.issue.reopen}
            </button>
          ) : null}
        </div>

        {milestone ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="press mt-3 w-full rounded-xl border border-day-amber bg-day-amber/15 p-3 text-left text-sm font-semibold text-ink"
          >
            {tr(t.share.milestone, { n: milestone })}
          </button>
        ) : null}

        {message ? (
          <p className="mt-3 rounded-lg bg-surface-2 p-2.5 text-xs font-medium text-body">{message}</p>
        ) : null}

        {/* map preview */}
        <section className="mt-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{t.issue.location}</h2>
          <a
            href={`/map?lat=${issue.location.lat}&lng=${issue.location.lng}&slug=${issue.slug}`}
            className="press mt-2 flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink">
              <PinIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{t.issue.viewMap}</span>
              <span className="block truncate text-xs text-muted">
                {issue.location.lat.toFixed(5)}, {issue.location.lng.toFixed(5)}
              </span>
            </span>
          </a>
        </section>

        {/* timeline */}
        <section className="mt-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{t.issue.timeline}</h2>
          <ol className="mt-2 space-y-3 border-l border-line pl-4">
            {entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-paper bg-line-strong" />
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {t.issue.statusReported === entry.text ? "" : ""}
                  {entry.type.replace("_", " ")} ·{" "}
                  {new Date(entry.createdAt).toLocaleString(locale === "fil" ? "fil-PH" : "en-PH", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Asia/Manila",
                  })}
                </p>
                {entry.text ? <p className="text-sm text-body">{entry.text}</p> : null}
                {entry.photos?.length ? (
                  <div className="mt-1 flex gap-1.5">
                    {entry.photos.map((photo) => (
                      <img
                        key={photo.url}
                        src={photo.url}
                        alt=""
                        width={photo.width}
                        height={photo.height}
                        loading="lazy"
                        className="h-20 w-24 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                <p className="mt-0.5 text-[11px] text-muted">{entry.authorName}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* add update */}
        <section className="mt-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{t.issue.addUpdate}</h2>
          <div className="mt-2 rounded-xl border border-line bg-surface p-3">
            <textarea
              value={updateText}
              onChange={(event) => setUpdateText(event.target.value)}
              placeholder={t.issue.updatePlaceholder}
              rows={3}
              maxLength={1000}
              className="w-full resize-none bg-transparent text-sm text-body outline-none placeholder:text-muted"
            />
            {updatePhoto ? (
              <div className="flex items-center gap-2">
                <img src={updatePhoto} alt="" className="h-16 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setUpdatePhoto(null)}
                  className="press text-xs font-semibold text-muted"
                >
                  {t.common.cancel}
                </button>
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between">
              <label className="press inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-xs font-semibold text-body">
                {busy === "photo" ? <SpinnerIcon size={14} /> : <CameraIcon size={16} />}
                {t.issue.photos}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void attachPhoto(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={postUpdate}
                disabled={busy !== null || (!updateText.trim() && !updatePhoto)}
                className="press rounded-lg bg-ink px-4 py-2 text-xs font-bold text-paper disabled:opacity-50"
              >
                {busy === "update" ? <SpinnerIcon size={14} /> : t.common.save}
              </button>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={flag}
            disabled={flagged || busy !== null}
            className="press inline-flex items-center gap-1.5 text-xs font-semibold text-muted"
          >
            <FlagIcon size={14} />
            {flagged ? t.issue.flagged : t.issue.flag}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-muted">{t.issue.disclaimer}</p>
        </div>
      </div>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        slug={issue.slug}
        title={issue.title}
        days={issue.days}
        fixed={status === "fixed"}
      />
    </div>
  );
}
