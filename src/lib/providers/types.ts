export type TaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";

export type GenerateInput =
  | { kind: "text"; prompt: string }
  | { kind: "image"; imageDataUrl: string; prompt?: string };

export interface CreateTaskResult {
  /** Opaque id the client passes back when polling. */
  taskId: string;
}

export interface TaskState {
  taskId: string;
  status: TaskStatus;
  /** 0 - 100 */
  progress: number;
  /** Human readable stage label, e.g. "生成形狀" / "貼圖" */
  stage?: string;
  /** Final GLB url (may be remote; client loads it through /api/model). */
  modelUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface ModelProvider {
  readonly name: string;
  createTask(input: GenerateInput): Promise<CreateTaskResult>;
  getTask(taskId: string): Promise<TaskState>;
}
