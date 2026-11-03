import { WaterHeader } from "@/components/headers";
import { Bar, PanelSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <WaterHeader />
      <div className="space-y-3 px-3 pt-2" aria-hidden>
        <div className="grid grid-cols-2 gap-2">
          <Bar className="h-24 rounded-xl" />
          <Bar className="h-24 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Bar className="h-3 w-40" />
          <Bar className="h-10 w-full rounded-xl" />
          <Bar className="h-10 w-full rounded-xl" />
        </div>
      </div>
      <PanelSkeleton blocks={2} />
    </>
  );
}
