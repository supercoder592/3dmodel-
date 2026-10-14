import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams a remote GLB through our origin so the browser can load it without
 * CORS issues and so the user can download it with a nice filename.
 * Only hosts of the configured providers are allowed (no open proxy).
 */
const ALLOWED_HOST_SUFFIXES = [".meshy.ai", ".tripo3d.ai", ".tripo3d.com"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const download = searchParams.get("download");
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  const hostOk =
    target.protocol === "https:" &&
    ALLOWED_HOST_SUFFIXES.some((s) => target.hostname === s.slice(1) || target.hostname.endsWith(s));
  if (!hostOk) return NextResponse.json({ error: "host not allowed" }, { status: 403 });

  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
  }
  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "model/gltf-binary",
    "Cache-Control": "private, max-age=3600",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  if (download) {
    headers.set("Content-Disposition", `attachment; filename="${safeName(download)}.glb"`);
  }
  return new Response(upstream.body, { headers });
}

function safeName(s: string) {
  return s.replace(/[^\w\-一-鿿]+/g, "_").slice(0, 60) || "model";
}
