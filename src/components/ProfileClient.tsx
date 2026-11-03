"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

import { useI18n, useTheme } from "@/components/Providers";
import { ProfileHeader } from "@/components/headers";
import { DaysBadge } from "@/components/issue";
import { SpinnerIcon } from "@/components/icons";
import { apiSend } from "@/lib/api-client";
import type { PublicIssue } from "@/lib/dto";

export function ProfileClient({
  name,
  email,
  role,
  alias,
  showName,
  myIssues,
  confirmations,
  signedIn,
}: {
  name: string | null;
  email: string | null;
  role: string;
  alias: string;
  showName: boolean;
  myIssues: PublicIssue[];
  confirmations: number;
  signedIn: boolean;
}) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [displayAlias, setDisplayAlias] = useState(alias);
  const [show, setShow] = useState(showName);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy("save");
    try {
      await apiSend("/api/profile", "PATCH", { displayAlias, showName: show });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ProfileHeader />

      <div className="space-y-3 p-3">
        {!signedIn ? (
          <div className="card p-4">
            <p className="text-sm font-bold text-ink">{t.profile.signIn}</p>
            <p className="mt-1 text-xs text-muted">{t.profile.signInHint}</p>
            <Link
              href="/login"
              className="press mt-3 block rounded-xl bg-ink py-2.5 text-center text-sm font-bold text-paper"
            >
              {t.profile.signIn}
            </Link>
          </div>
        ) : (
          <div className="card p-4">
            <p className="text-base font-bold text-ink">{name ?? displayAlias}</p>
            <p className="text-xs text-muted">{email ?? "Phone account"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip">
                {role === "moderator" ? "Moderator" : role === "official" ? "Official" : "Resident"}
              </span>
              <span className="chip">{myIssues.length} {t.profile.myReports.toLowerCase()}</span>
              <span className="chip">{confirmations} {t.profile.myConfirmations.toLowerCase()}</span>
            </div>
            {role === "moderator" || role === "official" ? (
              <Link
                href="/mod"
                className="press mt-3 block rounded-xl border border-line py-2.5 text-center text-sm font-bold text-body"
              >
                {t.profile.moderator}
              </Link>
            ) : null}
          </div>
        )}

        <section className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            {t.profile.settings}
          </h2>

          <label className="mt-3 block text-xs font-bold text-body" htmlFor="alias">
            {t.profile.alias}
          </label>
          <input
            id="alias"
            value={displayAlias}
            onChange={(event) => setDisplayAlias(event.target.value)}
            maxLength={40}
            disabled={!signedIn}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-body disabled:opacity-60"
          />
          <p className="mt-1 text-[11px] text-muted">{t.profile.aliasHint}</p>

          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-body">{t.profile.showName}</span>
            <input
              type="checkbox"
              checked={show}
              onChange={(event) => setShow(event.target.checked)}
              disabled={!signedIn}
              className="size-5 accent-[var(--c-accent)]"
            />
          </label>

          <div className="mt-3">
            <p className="text-xs font-bold text-body">{t.profile.language}</p>
            <div className="mt-1 flex gap-2">
              {(["en", "fil"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={`press rounded-lg border px-3 py-1.5 text-xs font-bold ${
                    locale === code ? "border-ink bg-ink text-paper" : "border-line bg-paper text-body"
                  }`}
                >
                  {code === "en" ? "English" : "Filipino"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <p className="text-xs font-bold text-body">{t.profile.theme}</p>
            <div className="mt-1 flex gap-2">
              {(
                [
                  ["light", t.profile.light],
                  ["dark", t.profile.dark],
                  ["system", t.profile.system],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`press rounded-lg border px-3 py-1.5 text-xs font-bold ${
                    theme === value ? "border-ink bg-ink text-paper" : "border-line bg-paper text-body"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {signedIn ? (
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="press mt-4 min-h-11 w-full rounded-xl bg-ink text-sm font-bold text-paper"
            >
              {busy === "save" ? <SpinnerIcon size={16} /> : saved ? t.common.saved : t.common.save}
            </button>
          ) : null}
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
              {t.profile.myReports}
            </h2>
            <Link href="/leaderboards" className="text-[11px] font-bold text-accent">
              {t.leaderboard.title}
            </Link>
          </div>
          <ul className="mt-2 space-y-2">
            {myIssues.length === 0 ? (
              <li className="text-sm text-muted">{t.profile.noReports}</li>
            ) : null}
            {myIssues.map((issue) => (
              <li key={issue.id}>
                <Link
                  href={`/issue/${issue.slug}`}
                  className="press flex items-center gap-2 rounded-lg border border-line p-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-sm font-semibold text-ink">
                      {issue.title}
                    </span>
                    <span className="text-[11px] text-muted">{issue.barangay?.name}</span>
                  </span>
                  <DaysBadge
                    days={issue.days}
                    fixed={issue.status === "fixed"}
                    daysToFix={issue.daysToFix}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {signedIn ? (
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="press w-full rounded-xl border border-line bg-surface py-3 text-sm font-bold text-body"
          >
            {t.profile.signOut}
          </button>
        ) : null}

        <p className="pb-2 text-center text-[10px] text-muted">{t.issue.disclaimer}</p>
      </div>
    </>
  );
}
