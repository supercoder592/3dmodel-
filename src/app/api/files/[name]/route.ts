import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDataDir } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAME_RE = /^[\w-]+\.(glb|png)$/;
const TYPES: Record<string, string> = { glb: "model/gltf-binary", png: "image/png" };

/** Serves models / preview images produced by the self-hosted pipeline. */
export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!NAME_RE.test(name)) return NextResponse.json({ error: "bad name" }, { status: 400 });
  const file = path.join(getDataDir(), "files", name);
  try {
    const buf = await fs.readFile(file);
    const ext = name.split(".").pop()!;
    const headers = new Headers({ "Content-Type": TYPES[ext], "Cache-Control": "private, max-age=31536000, immutable" });
    const download = new URL(req.url).searchParams.get("download");
    if (download) headers.set("Content-Disposition", `attachment; filename="${download.replace(/[^\w\-一-鿿]+/g, "_").slice(0, 60) || "model"}.${ext}"`);
    return new Response(new Uint8Array(buf), { headers });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
