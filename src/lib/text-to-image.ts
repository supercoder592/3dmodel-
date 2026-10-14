/**
 * Text -> reference image for the self-hosted pipeline.
 *
 * Speaks the AUTOMATIC1111 / Forge `POST /sdapi/v1/txt2img` dialect, which is
 * also what our tiny `server/t2i_server.py` sidecar implements, so any of
 * those can sit behind T2I_URL.
 */
export interface TextToImageConfig {
  baseUrl: string;
  steps: number;
  width: number;
  height: number;
  cfgScale: number;
  timeoutMs: number;
}

const STYLE_SUFFIX =
  ", single object, centered, full view, isolated on plain white background, 3D render, soft studio lighting, high detail, no shadow";
const NEGATIVE =
  "multiple objects, cropped, cut off, text, watermark, logo, blurry, low quality, background scenery, people, hands";

export async function textToImage(cfg: TextToImageConfig, prompt: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt + STYLE_SUFFIX,
        negative_prompt: NEGATIVE,
        steps: cfg.steps,
        width: cfg.width,
        height: cfg.height,
        cfg_scale: cfg.cfgScale,
        batch_size: 1,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`文字轉圖片服務回應 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { images?: string[] };
    const b64 = data.images?.[0];
    if (!b64) throw new Error("文字轉圖片服務沒有回傳圖片");
    // A1111 may return a bare base64 string or a data URI.
    return Buffer.from(b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64, "base64");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("文字轉圖片逾時");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
