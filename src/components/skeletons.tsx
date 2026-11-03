/**
 * Loading shells.
 *
 * Every data page is `force-dynamic`: its RSC render waits on Mongo, so without
 * a fallback the OLD screen stays on-screen until the query returns. A
 * `loading.tsx` in the segment is what Next paints immediately on navigation
 * (and mirrors while a `<Link>` prefetches), so a page switch feels like a
 * native tab change: shell now, content in a beat.
 *
 * The skeletons deliberately reuse the real page's geometry — same card radius,
 * same image ratio, same row heights — so the swap does not jump.
 */

export function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function FeedSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-3 pt-2" aria-hidden>
      <div className="flex gap-2">
        <Bar className="h-9 w-32 rounded-full" />
        <Bar className="h-9 w-20 rounded-full" />
        <Bar className="h-9 w-20 rounded-full" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bar key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>
      <Bar className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <Bar className="aspect-[16/9] w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Bar className="h-4 w-4/5" />
            <Bar className="h-3 w-2/5" />
            <Bar className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
          <Bar className="size-14 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Bar className="h-3.5 w-3/4" />
            <Bar className="h-3 w-2/5" />
          </div>
          <Bar className="h-7 w-12 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <div className="space-y-3 p-3" aria-hidden>
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-3">
          <div className="flex items-start gap-3">
            <Bar className="size-16 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3.5 w-2/3" />
              <Bar className="h-3 w-1/2" />
              <Bar className="h-3 w-1/3" />
            </div>
          </div>
          <Bar className="mt-3 h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** A map with its control chips, painted before Leaflet has even parsed. */
export function MapSkeleton() {
  return (
    <div className="relative" aria-hidden>
      <div className="relative h-[calc(100dvh-8.5rem)] w-full overflow-hidden bg-surface-2">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--c-line)_1px,transparent_1px),linear-gradient(90deg,var(--c-line)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
          {["w-24", "w-32", "w-20"].map((w) => (
            <div key={w} className={`h-10 ${w} rounded-full border border-line bg-surface`} />
          ))}
        </div>
        <div className="absolute left-3 top-3 flex flex-col gap-px overflow-hidden rounded-lg border border-line">
          <div className="grid size-8 place-items-center bg-surface text-muted">+</div>
          <div className="grid size-8 place-items-center bg-surface text-muted">−</div>
        </div>
        <p className="absolute inset-x-0 top-1/2 text-center text-xs font-semibold text-muted">
          Loading the map…
        </p>
      </div>
    </div>
  );
}

