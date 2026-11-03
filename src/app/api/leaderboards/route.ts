import { handler, item } from "@/lib/api";
import { getLeaderboards } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const GET = handler(async () => {
  const data = await getLeaderboards();
  return item(data);
});
