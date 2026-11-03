import { ProfileHeader } from "@/components/headers";
import { PanelSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <ProfileHeader />
      <PanelSkeleton blocks={3} />
    </>
  );
}
