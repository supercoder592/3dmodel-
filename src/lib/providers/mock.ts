import type { CreateTaskResult, GenerateInput, ModelProvider, TaskState } from "./types";

/**
 * Offline provider used when no API key is configured. It fakes a ~12s job
 * and returns one of the bundled sample models so the whole UI can be
 * exercised without credits. State lives in the task id itself so it works
 * across serverless instances.
 */
const SAMPLES = ["/samples/Duck.glb", "/samples/Fox.glb", "/samples/CesiumMilkTruck.glb"];
const DURATION_MS = 12_000;

export class MockProvider implements ModelProvider {
  readonly name = "mock";

  async createTask(input: GenerateInput): Promise<CreateTaskResult> {
    const seed = input.kind === "text" ? input.prompt : input.imageDataUrl.slice(0, 200);
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const sample = h % SAMPLES.length;
    return { taskId: `mock:${Date.now()}:${sample}` };
  }

  async getTask(taskId: string): Promise<TaskState> {
    const [, startStr, sampleStr] = taskId.split(":");
    const start = Number(startStr);
    const sample = Number(sampleStr) || 0;
    if (!Number.isFinite(start)) throw new Error("bad task id");
    const elapsed = Date.now() - start;
    const progress = Math.min(100, Math.round((elapsed / DURATION_MS) * 100));
    if (progress >= 100) {
      return { taskId, status: "SUCCEEDED", progress: 100, modelUrl: SAMPLES[sample] };
    }
    return {
      taskId,
      status: elapsed < 1000 ? "PENDING" : "IN_PROGRESS",
      progress,
      stage: progress < 50 ? "生成形狀（示範模式）" : "產生貼圖（示範模式）",
    };
  }
}
