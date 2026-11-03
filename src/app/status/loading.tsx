import { StatusHeader } from "@/components/headers";
import { PanelSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <StatusHeader />
      <PanelSkeleton blocks={3} />
    </>
  );
}
