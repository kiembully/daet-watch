"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

import { LoginHeader } from "@/components/headers";
import { useI18n } from "@/components/Providers";
import { SpinnerIcon } from "@/components/icons";

export function LoginClient({
  providers,
  demoEnabled,
  next,
  signedIn,
}: {
  providers: { google: boolean; facebook: boolean };
  demoEnabled: boolean;
  next: string;
  signedIn: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (signedIn) {
    return (
      <>
        <LoginHeader />
        <div className="p-6 text-center">
          <p className="text-sm text-body">You are already signed in.</p>
          <button
            type="button"
            onClick={() => router.push(next)}
            className="press mt-4 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper"
          >
            Continue
          </button>
        </div>
      </>
    );
  }

  const start = async (provider: string, credentials?: Record<string, string>) => {
    setBusy(provider);
    setError(null);
    try {
      const result = await signIn(provider, {
        ...(credentials ?? {}),
        redirect: false,
        callbackUrl: next,
      });
      if (result?.error) {
        setError(t.common.error);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError(t.common.error);
    } finally {
      setBusy(null);
    }
  };

  const hasOAuth = providers.google || providers.facebook;

  return (
    <>
      <LoginHeader />
      <div className="space-y-3 p-4">
        <p className="text-sm leading-relaxed text-body">{t.login.subtitle}</p>

        {providers.google ? (
          <button
            type="button"
            onClick={() => start("google")}
            disabled={busy !== null}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-bold text-ink"
          >
            {busy === "google" ? <SpinnerIcon size={16} /> : null}
            {t.login.google}
          </button>
        ) : null}

        {providers.facebook ? (
          <button
            type="button"
            onClick={() => start("facebook")}
            disabled={busy !== null}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-bold text-ink"
          >
            {busy === "facebook" ? <SpinnerIcon size={16} /> : null}
            {t.login.facebook}
          </button>
        ) : null}

        {demoEnabled ? (
          <>
            {hasOAuth ? (
              <div className="flex items-center gap-2 py-1 text-[11px] uppercase tracking-widest text-muted">
                <span className="h-px flex-1 bg-line" />
                {t.login.or}
                <span className="h-px flex-1 bg-line" />
              </div>
            ) : null}

            <label className="block text-xs font-bold uppercase tracking-wide text-muted" htmlFor="phone">
              {t.login.phoneLabel}
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t.login.phonePlaceholder}
              className="w-full rounded-lg border border-line bg-surface px-3 py-3 text-sm text-body"
            />
            <button
              type="button"
              onClick={() => start("phone", { phone })}
              disabled={busy !== null || phone.replace(/\D/g, "").length !== 11}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-paper disabled:opacity-40"
            >
              {busy === "phone" ? <SpinnerIcon size={16} /> : null}
              {t.login.phone}
            </button>
            <p className="text-[11px] leading-relaxed text-muted">{t.login.demoNote}</p>
          </>
        ) : null}

        {!hasOAuth && !demoEnabled ? (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-body">
            No sign-in method is configured yet. Add Google or Facebook credentials to the
            environment, or set <code className="font-mono">ENABLE_DEMO_LOGIN=1</code>.
          </p>
        ) : null}

        {error ? <p className="text-sm text-day-red">{error}</p> : null}

        <p className="pt-2 text-[11px] leading-relaxed text-muted">
          Your name is hidden by default. Reports show &ldquo;Neighbor from Brgy. …&rdquo; until you
          choose otherwise.
        </p>
      </div>
    </>
  );
}
