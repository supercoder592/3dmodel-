import Studio from "@/components/Studio";
import { isDemoMode } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Studio demo={isDemoMode()} />;
}
