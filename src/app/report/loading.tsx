import { Bar } from "@/components/skeletons";

/** The report flow's own chrome: progress bar, a grid of category tiles. */
export default function Loading() {
  return (
    <div aria-hidden>
      <div className="sticky top-0 z-30 safe-top bg-paper/95 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <Bar className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Bar className="h-2.5 w-24" />
            <Bar className="h-3.5 w-40" />
          </div>
        </div>
        <Bar className="h-1 w-full rounded-none" />
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bar key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="px-3">
        <Bar className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
