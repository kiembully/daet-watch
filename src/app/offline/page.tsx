import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-day-red text-day-red-ink">
        <span className="daynum text-3xl font-black">!</span>
      </div>
      <h1 className="text-xl font-bold text-ink">You&apos;re offline</h1>
      <p className="max-w-xs text-sm text-muted">
        Saved issues and your pending reports are still here. New reports are queued on this phone
        and post themselves when the signal comes back.
      </p>
      <Link
        href="/"
        className="press rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper"
      >
        Try again
      </Link>
    </div>
  );
}
