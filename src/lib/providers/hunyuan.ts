import { promises as fs } from "node:fs";
import path from "node:path";
import type { CreateTaskResult, GenerateInput, ModelProvider, TaskState } from "./types";
import { textToImage, type TextToImageConfig } from "../text-to-image";

/**
 * Self-hosted Hunyuan3D provider. Talks to the official `api_server.py`
 * from Tencent-Hunyuan/Hunyuan3D-2 or Hunyuan3D-2.1:
 *
 *   POST /send            { image: <base64>, texture, ... }  -> { uid }
 *   GET  /status/{uid}    { status: processing|texturing|completed|error, model_base64?, message? }
 *
 * Text prompts are first turned into a reference image with a local
 * text-to-image endpoint (see ../text-to-image.ts), then sent to Hunyuan3D.
 * The finished GLB is stored under DATA_DIR and served by /api/files.
 *
 * Task id format:  hy:<uid>:<startMs>:<texture 0|1>
 * (`api_server.py` never reports failures of background jobs, so we time out.)
 */
export interface HunyuanConfig {
  baseUrl: string;
  texture: boolean;
  dataDir: string;
  timeoutMs: number;
  octreeResolution: number;
  steps: number;
  t2i: TextToImageConfig | null;
}

// Rough wall-clock estimates used only for the progress bar.
const SHAPE_EST_MS = 90_000;
const TEXTURE_EST_MS = 240_000;

export class HunyuanProvider implements ModelProvider {
  readonly name = "hunyuan";
  constructor(private cfg: HunyuanConfig) {}

  async createTask(input: GenerateInput): Promise<CreateTaskResult> {
    let imageBase64: string;
    let previewPng: Buffer | null = null;

    if (input.kind === "image") {
      imageBase64 = stripDataUrl(input.imageDataUrl);
    } else {
      if (!this.cfg.t2i) {
        throw new Error("400:文字建模需要設定文字轉圖片服務（T2I_URL），或改用圖片建模");
      }
      previewPng = await textToImage(this.cfg.t2i, input.prompt);
      imageBase64 = previewPng.toString("base64");
    }

    const res = await fetch(`${this.cfg.baseUrl}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageBase64,
        texture: this.cfg.texture,
        octree_resolution: this.cfg.octreeResolution,
        num_inference_steps: this.cfg.steps,
        type: "glb",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Hunyuan3D /send ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { uid?: string; error?: string };
    if (!data.uid) throw new Error(`Hunyuan3D /send 沒有回傳 uid：${data.error ?? JSON.stringify(data)}`);

    if (previewPng) {
      await this.writeFile(`${data.uid}.png`, previewPng);
    }
    return { taskId: `hy:${data.uid}:${Date.now()}:${this.cfg.texture ? 1 : 0}` };
  }

  async getTask(taskId: string): Promise<TaskState> {
    const [, uid, startStr, texStr] = taskId.split(":");
    if (!uid || !/^[\w-]+$/.test(uid)) throw new Error("bad task id");
    const start = Number(startStr) || Date.now();
    const texture = texStr === "1";
    const elapsed = Date.now() - start;
    const thumbnailUrl = (await this.exists(`${uid}.png`)) ? `/api/files/${uid}.png` : undefined;

    // Already stored from a previous poll (status endpoint re-reads the whole file each time).
    if (await this.exists(`${uid}.glb`)) {
      return { taskId, status: "SUCCEEDED", progress: 100, modelUrl: `/api/files/${uid}.glb`, thumbnailUrl };
    }

    const res = await fetch(`${this.cfg.baseUrl}/status/${uid}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { status?: string; model_base64?: string; message?: string };

    if (data.status === "completed" && data.model_base64) {
      await this.writeFile(`${uid}.glb`, Buffer.from(data.model_base64, "base64"));
      return { taskId, status: "SUCCEEDED", progress: 100, modelUrl: `/api/files/${uid}.glb`, thumbnailUrl };
    }
    if (data.status === "error" || !res.ok) {
      return { taskId, status: "FAILED", progress: 0, error: data.message ?? `Hunyuan3D 回應 ${res.status}`, thumbnailUrl };
    }
    if (elapsed > this.cfg.timeoutMs) {
      return { taskId, status: "FAILED", progress: 0, error: "生成逾時，請檢查 Hunyuan3D 伺服器的 log", thumbnailUrl };
    }

    if (data.status === "texturing") {
      const p = 50 + Math.min(45, Math.round((Math.max(0, elapsed - SHAPE_EST_MS) / TEXTURE_EST_MS) * 45));
      return { taskId, status: "IN_PROGRESS", progress: p, stage: "產生 PBR 貼圖", thumbnailUrl };
    }
    const cap = texture ? 48 : 95;
    const p = Math.min(cap, Math.round((elapsed / SHAPE_EST_MS) * cap));
    return { taskId, status: elapsed < 2000 ? "PENDING" : "IN_PROGRESS", progress: p, stage: "生成形狀", thumbnailUrl };
  }

  private filePath(name: string) {
    return path.join(this.cfg.dataDir, "files", name);
  }
  private async exists(name: string) {
    return fs.access(this.filePath(name)).then(() => true, () => false);
  }
  private async writeFile(name: string, buf: Buffer) {
    await fs.mkdir(path.dirname(this.filePath(name)), { recursive: true });
    const tmp = this.filePath(`${name}.${process.pid}.tmp`);
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, this.filePath(name));
  }
}

function stripDataUrl(dataUrl: string) {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}
