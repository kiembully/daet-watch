import { Bar } from "@/components/skeletons";

/** Mirrors the issue page: photo, then the hero counter block, then the text. */
export default function Loading() {
  return (
    <div aria-hidden>
      <Bar className="aspect-[4/3] w-full rounded-none" />
      <div className="-mt-3 space-y-3 rounded-t-3xl bg-paper px-3 pt-3">
        <div className="flex gap-2">
          <Bar className="h-28 flex-1 rounded-2xl" />
        </div>
        <div className="flex gap-2">
          <Bar className="h-6 w-24 rounded-full" />
          <Bar className="h-6 w-20 rounded-full" />
        </div>
        <Bar className="h-6 w-4/5" />
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-11/12" />
        <Bar className="mt-4 h-12 w-full rounded-xl" />
        <Bar className="h-24 w-full rounded-xl" />
        <div className="space-y-2 pt-2">
          <Bar className="h-3 w-32" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-10/12" />
        </div>
      </div>
    </div>
  );
}
