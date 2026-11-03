import { HomeHeader } from "@/components/headers";
import { FeedSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <HomeHeader />
      <FeedSkeleton />
    </>
  );
}
