import { LoginHeader } from "@/components/headers";
import { Bar } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <LoginHeader />
      <div className="space-y-3 p-4" aria-hidden>
        <Bar className="h-3 w-4/5" />
        <Bar className="h-12 w-full rounded-xl" />
        <Bar className="h-12 w-full rounded-xl" />
        <Bar className="h-12 w-full rounded-xl" />
      </div>
    </>
  );
}
