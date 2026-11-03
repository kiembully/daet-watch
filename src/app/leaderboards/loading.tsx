import { LeaderboardHeader } from "@/components/headers";
import { ListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <LeaderboardHeader />
      <ListSkeleton rows={5} />
    </>
  );
}
