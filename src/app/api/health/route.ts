import { NextResponse } from "next/server";
import { getEngineInfo } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getEngineInfo(), { headers: { "Cache-Control": "no-store" } });
}
