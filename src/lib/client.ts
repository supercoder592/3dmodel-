import type { TaskState } from "./providers/types";

export interface HistoryItem {
  id: string;
  kind: "text" | "image";
  label: string;
  modelUrl: string;
  thumbnailUrl?: string;
  createdAt: number;
}

const KEY = "3dstudio.history.v1";

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Turn a provider model url into something the browser can fetch from our origin. */
export function toViewerUrl(modelUrl: string): string {
  if (modelUrl.startsWith("/")) return modelUrl;
  return `/api/model?url=${encodeURIComponent(modelUrl)}`;
}

export function toDownloadUrl(modelUrl: string, name: string): string {
  if (modelUrl.startsWith("/")) return modelUrl;
  return `/api/model?url=${encodeURIComponent(modelUrl)}&download=${encodeURIComponent(name)}`;
}

export async function createTask(form: FormData): Promise<{ taskId: string; kind: "text" | "image"; demo: boolean }> {
  const res = await fetch("/api/generate", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function fetchTask(taskId: string): Promise<TaskState> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}
