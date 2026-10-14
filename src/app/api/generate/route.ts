import { NextResponse } from "next/server";
import { getProvider, isDemoMode } from "@/lib/providers";
import type { GenerateInput } from "@/lib/providers/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request) {
  try {
    const input = await parseInput(req);
    const provider = getProvider();
    const { taskId } = await provider.createTask(input);
    return NextResponse.json({ taskId, kind: input.kind, demo: isDemoMode() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const status = message.startsWith("400:") ? 400 : 500;
    return NextResponse.json({ error: message.replace(/^400:/, "") }, { status });
  }
}

async function parseInput(req: Request): Promise<GenerateInput> {
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    const prompt = String(form.get("prompt") ?? "").trim();
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_TYPES.has(file.type)) throw new Error("400:只支援 PNG / JPEG / WebP 圖片");
      if (file.size > MAX_IMAGE_BYTES) throw new Error("400:圖片不可超過 20MB");
      const buf = Buffer.from(await file.arrayBuffer());
      return {
        kind: "image",
        imageDataUrl: `data:${file.type};base64,${buf.toString("base64")}`,
        prompt: prompt || undefined,
      };
    }
    if (prompt) return { kind: "text", prompt: clampPrompt(prompt) };
    throw new Error("400:請輸入描述或上傳圖片");
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string; imageDataUrl?: string };
  if (body.imageDataUrl?.startsWith("data:image/")) {
    return { kind: "image", imageDataUrl: body.imageDataUrl, prompt: body.prompt?.trim() || undefined };
  }
  const prompt = body.prompt?.trim();
  if (prompt) return { kind: "text", prompt: clampPrompt(prompt) };
  throw new Error("400:請輸入描述或上傳圖片");
}

function clampPrompt(p: string) {
  return p.length > 800 ? p.slice(0, 800) : p;
}
