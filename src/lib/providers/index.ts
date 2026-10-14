import path from "node:path";
import { HunyuanProvider } from "./hunyuan";
import { MeshyProvider } from "./meshy";
import { MockProvider } from "./mock";
import type { ModelProvider } from "./types";

let cached: ModelProvider | null = null;

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : d;
};

export function getDataDir() {
  return path.resolve(process.cwd(), process.env.DATA_DIR ?? "data");
}

export function getProvider(): ModelProvider {
  if (cached) return cached;
  const wanted = (process.env.MODEL_PROVIDER ?? "auto").toLowerCase();
  const meshyKey = process.env.MESHY_API_KEY?.trim();
  const hunyuanUrl = process.env.HUNYUAN_URL?.trim().replace(/\/$/, "");
  const t2iUrl = process.env.T2I_URL?.trim().replace(/\/$/, "");

  const pick = wanted === "auto" ? (hunyuanUrl ? "hunyuan" : meshyKey ? "meshy" : "mock") : wanted;

  if (pick === "hunyuan" && hunyuanUrl) {
    cached = new HunyuanProvider({
      baseUrl: hunyuanUrl,
      texture: process.env.HUNYUAN_TEXTURE !== "0",
      dataDir: getDataDir(),
      timeoutMs: num(process.env.HUNYUAN_TIMEOUT_SEC, 1800) * 1000,
      octreeResolution: num(process.env.HUNYUAN_OCTREE_RESOLUTION, 256),
      steps: num(process.env.HUNYUAN_STEPS, 30),
      t2i: t2iUrl
        ? {
            baseUrl: t2iUrl,
            steps: num(process.env.T2I_STEPS, 4),
            width: num(process.env.T2I_SIZE, 768),
            height: num(process.env.T2I_SIZE, 768),
            cfgScale: num(process.env.T2I_CFG, 1),
            timeoutMs: num(process.env.T2I_TIMEOUT_SEC, 120) * 1000,
          }
        : null,
    });
  } else if (pick === "meshy" && meshyKey) {
    cached = new MeshyProvider(meshyKey, process.env.MESHY_SKIP_REFINE === "1");
  } else {
    if (pick !== "mock") {
      console.warn(`[3dmodel] provider "${pick}" 缺少設定（HUNYUAN_URL / MESHY_API_KEY），改用 mock 示範模式`);
    }
    cached = new MockProvider();
  }
  return cached;
}

export function isDemoMode(): boolean {
  return getProvider().name === "mock";
}

export interface EngineInfo {
  provider: string;
  demo: boolean;
  textToModel: boolean;
  notes: string[];
}

/** Lightweight status for the UI banner and /api/health. */
export async function getEngineInfo(): Promise<EngineInfo> {
  const p = getProvider();
  const notes: string[] = [];
  let textToModel = true;

  if (p.name === "hunyuan") {
    const url = process.env.HUNYUAN_URL!.replace(/\/$/, "");
    const ok = await ping(`${url}/health`).catch(() => false);
    if (!ok) notes.push(`連不到 Hunyuan3D 伺服器 (${url})`);
    const t2i = process.env.T2I_URL?.trim();
    if (!t2i) {
      textToModel = false;
      notes.push("未設定 T2I_URL，只能用圖片建模");
    } else if (!(await ping(`${t2i.replace(/\/$/, "")}/health`).catch(() => false))) {
      notes.push(`連不到文字轉圖片服務 (${t2i})`);
    }
  }
  return { provider: p.name, demo: p.name === "mock", textToModel, notes };
}

async function ping(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    return r.ok;
  } finally {
    clearTimeout(t);
  }
}
