import type { CreateTaskResult, GenerateInput, ModelProvider, TaskState, TaskStatus } from "./types";

const BASE = "https://api.meshy.ai/openapi";

interface MeshyTask {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  model_urls?: { glb?: string };
  thumbnail_url?: string;
  task_error?: { message?: string };
}

/**
 * Task ids handed to the client are namespaced so a stateless GET can tell
 * which Meshy endpoint to poll:
 *   tp:<id>  text-to-3d preview (shape only)
 *   tr:<id>  text-to-3d refine  (textured)
 *   im:<id>  image-to-3d
 */
export class MeshyProvider implements ModelProvider {
  readonly name = "meshy";
  constructor(private apiKey: string, private skipRefine: boolean) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Meshy ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async createTask(input: GenerateInput): Promise<CreateTaskResult> {
    if (input.kind === "text") {
      const r = await this.call<{ result: string }>("/v2/text-to-3d", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          prompt: input.prompt,
          should_remesh: true,
        }),
      });
      return { taskId: `tp:${r.result}` };
    }
    const r = await this.call<{ result: string }>("/v1/image-to-3d", {
      method: "POST",
      body: JSON.stringify({
        image_url: input.imageDataUrl,
        should_texture: true,
        enable_pbr: true,
        should_remesh: true,
        ...(input.prompt ? { texture_prompt: input.prompt } : {}),
      }),
    });
    return { taskId: `im:${r.result}` };
  }

  async getTask(taskId: string): Promise<TaskState> {
    const [ns, id] = taskId.split(":", 2);
    if (!id) throw new Error("bad task id");

    if (ns === "tp") {
      const t = await this.call<MeshyTask>(`/v2/text-to-3d/${id}`);
      if (t.status === "SUCCEEDED" && !this.skipRefine) {
        // Chain into the refine (texturing) stage; return the new id so the
        // client keeps polling the right task.
        const r = await this.call<{ result: string }>("/v2/text-to-3d", {
          method: "POST",
          body: JSON.stringify({ mode: "refine", preview_task_id: id, enable_pbr: true }),
        });
        return { taskId: `tr:${r.result}`, status: "IN_PROGRESS", progress: 50, stage: "產生貼圖" };
      }
      // Preview is half of the job.
      const s = norm(t, taskId, "生成形狀");
      if (!this.skipRefine && s.status !== "FAILED") s.progress = Math.round(s.progress / 2);
      return s;
    }
    if (ns === "tr") {
      const t = await this.call<MeshyTask>(`/v2/text-to-3d/${id}`);
      const s = norm(t, taskId, "產生貼圖");
      if (s.status !== "FAILED") s.progress = 50 + Math.round(s.progress / 2);
      return s;
    }
    if (ns === "im") {
      const t = await this.call<MeshyTask>(`/v1/image-to-3d/${id}`);
      return norm(t, taskId, "圖片轉 3D");
    }
    throw new Error("unknown task namespace");
  }
}

function norm(t: MeshyTask, taskId: string, stage: string): TaskState {
  const status: TaskStatus = t.status === "CANCELED" ? "FAILED" : t.status;
  return {
    taskId,
    status,
    progress: status === "SUCCEEDED" ? 100 : (t.progress ?? 0),
    stage,
    modelUrl: t.model_urls?.glb,
    thumbnailUrl: t.thumbnail_url,
    error: status === "FAILED" ? (t.task_error?.message ?? "生成失敗") : undefined,
  };
}
