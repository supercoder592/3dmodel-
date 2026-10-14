import Studio from "@/components/Studio";
import { getEngineInfo } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <Studio engine={await getEngineInfo()} />;
}
