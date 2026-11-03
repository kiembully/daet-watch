"use client";

import Link from "next/link";

import { useI18n } from "@/components/Providers";
import { PinIcon } from "@/components/icons";
import type { PublicIssue } from "@/lib/dto";
import { dayTone, fixProgress, type DayTone } from "@/lib/rules";

const TONE_CLASS: Record<DayTone, string> = {
  neutral: "bg-day-neutral text-day-neutral-ink",
  amber: "bg-day-amber text-day-amber-ink",
  red: "bg-day-red text-day-red-ink",
};

/** The hero element: the number is the message. */
export function DaysBadge({
  days,
  variant = "card",
  fixed = false,
  daysToFix = null,
}: {
  days: number;
  variant?: "card" | "hero";
  fixed?: boolean;
  daysToFix?: number | null;
}) {
  const { t } = useI18n();
  const tone = fixed ? null : dayTone(days);
  const colour = fixed ? "bg-fixed text-fixed-ink" : TONE_CLASS[tone ?? "neutral"];

  if (variant === "hero") {
    return (
      <div className={`${colour} rounded-2xl px-5 py-4`}>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] opacity-80">
          {fixed ? t.issue.fixedAfter : t.issue.daysUnfixed}
        </p>
        <p className="daynum mt-1 text-[clamp(3.5rem,20vw,5.75rem)] font-black">
          {fixed ? (daysToFix ?? days) : days}
        </p>
        <p className="text-sm font-bold opacity-85">{t.issue.days}</p>
      </div>
    );
  }

  return (
    <div className={`${colour} inline-flex items-baseline gap-1.5 rounded-lg px-2.5 py-1.5`}>
      <span className="daynum text-2xl font-black leading-none">
        {fixed ? (daysToFix ?? days) : days}
      </span>
      <span className="text-[9px] font-extrabold uppercase leading-tight tracking-[0.12em]">
        {fixed ? t.issue.statusFixed : t.issue.daysUnfixed}
      </span>
    </div>
  );
}

export function StatusPill({ status }: { status: PublicIssue["status"] }) {
  const { t } = useI18n();
  const map: Record<PublicIssue["status"], { label: string; className: string }> = {
    reported: { label: t.issue.statusReported, className: "bg-surface-2 text-body" },
    confirmed: { label: t.issue.statusConfirmed, className: "bg-surface-2 text-body" },
    unfixed: { label: t.issue.statusUnfixed, className: "bg-day-amber/20 text-ink" },
    fixed: { label: t.issue.statusFixed, className: "bg-fixed text-fixed-ink" },
    reopened: { label: t.issue.statusReopened, className: "bg-day-red text-day-red-ink" },
    hidden: { label: t.issue.statusHidden, className: "bg-surface-2 text-muted" },
  };
  const entry = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${entry.className}`}
    >
      {entry.label}
    </span>
  );
}

export function CategoryChip({ category }: { category: PublicIssue["category"] }) {
  const { t } = useI18n();
  return <span className="chip">{t.categories[category]}</span>;
}

export function IssueCard({ issue, priority = false }: { issue: PublicIssue; priority?: boolean }) {
  const { t, tr, locale } = useI18n();
  const photo = issue.photos[0];
  const fixed = issue.status === "fixed";
  const progress = fixProgress(issue.fixVotes, issue.fixThreshold);

  return (
    <Link
      href={`/issue/${issue.slug}`}
      className="press block overflow-hidden rounded-2xl border border-line bg-surface"
    >
      {photo ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
          <img
            src={photo.url}
            alt={issue.title}
            width={photo.width}
            height={photo.height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover"
          />
          <div className="absolute bottom-2 left-2">
            <DaysBadge
              days={issue.days}
              fixed={fixed}
              daysToFix={issue.daysToFix}
              variant="card"
            />
          </div>
          {issue.status === "reopened" ? (
            <div className="absolute right-2 top-2">
              <StatusPill status="reopened" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="p-3">
        <h2 className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{issue.title}</h2>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <PinIcon size={12} />
            {issue.barangay?.name ?? "Daet"}
          </span>
          <span aria-hidden>·</span>
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            {t.categories[issue.category]}
          </span>
          {issue.confirmations > 0 ? (
            <span className="ml-auto font-semibold text-body">
              {tr(t.issue.neighborsAffected, { n: issue.confirmations })}
            </span>
          ) : null}
        </div>

        {!fixed && issue.fixVotes > 0 ? (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-ink/70"
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-medium text-muted">
              {tr(t.issue.fixProgress, { n: progress.votes, target: progress.target })}
            </p>
          </div>
        ) : null}

        <p className="mt-2 text-[10px] uppercase tracking-wide text-muted">
          {issue.reporter.displayName} ·{" "}
          {new Intl.DateTimeFormat(locale === "fil" ? "fil-PH" : "en-PH", {
            day: "numeric",
            month: "short",
            timeZone: "Asia/Manila",
          }).format(new Date(issue.reportedAt))}
        </p>
      </div>
    </Link>
  );
}

export function IssueCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="skeleton aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-3 w-2/5" />
      </div>
    </div>
  );
}
