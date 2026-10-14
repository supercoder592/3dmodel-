import { MeshyProvider } from "./meshy";
import { MockProvider } from "./mock";
import type { ModelProvider } from "./types";

let cached: ModelProvider | null = null;

export function getProvider(): ModelProvider {
  if (cached) return cached;
  const wanted = (process.env.MODEL_PROVIDER ?? "meshy").toLowerCase();
  const key = process.env.MESHY_API_KEY?.trim();
  if (wanted === "meshy" && key) {
    cached = new MeshyProvider(key, process.env.MESHY_SKIP_REFINE === "1");
  } else {
    if (wanted === "meshy") {
      console.warn("[3dmodel] MESHY_API_KEY 未設定，改用 mock provider（示範模式）");
    }
    cached = new MockProvider();
  }
  return cached;
}

export function isDemoMode(): boolean {
  return getProvider().name === "mock";
}
