import { ModHeader } from "@/components/headers";
import { ListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <ModHeader />
      <ListSkeleton rows={3} />
    </>
  );
}
