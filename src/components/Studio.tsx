"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createTask, fetchTask, loadHistory, saveHistory, toDownloadUrl, toViewerUrl, type HistoryItem } from "@/lib/client";
import type { TaskState } from "@/lib/providers/types";
import ImageDrop from "./ImageDrop";
import type { ViewerSettings } from "./ModelViewer";

const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });

type Mode = "text" | "image";
const POLL_MS = 2500;

const EXAMPLES = [
  "一隻可愛的卡通柴犬，坐姿，低多邊形風格",
  "A sci-fi hover bike with glowing blue engines",
  "復古木質收音機，黃銅旋鈕",
  "A cozy mushroom house with a tiny door and chimney",
];

export default function Studio({ demo }: { demo: boolean }) {
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [task, setTask] = useState<TaskState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [current, setCurrent] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<ViewerSettings>({ wireframe: false, autoRotate: true, background: "dark" });
  const [resetKey, setResetKey] = useState(0);

  const pollRef = useRef<number | null>(null);
  const labelRef = useRef("");

  useEffect(() => {
    const h = loadHistory();
    setHistory(h);
    if (h[0]) setCurrent(h[0]);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  const poll = useCallback(
    async (taskId: string, kind: Mode) => {
      try {
        const s = await fetchTask(taskId);
        setTask(s);
        if (s.status === "SUCCEEDED" && s.modelUrl) {
          const item: HistoryItem = {
            id: s.taskId,
            kind,
            label: labelRef.current,
            modelUrl: s.modelUrl,
            thumbnailUrl: s.thumbnailUrl,
            createdAt: Date.now(),
          };
          setCurrent(item);
          setHistory((prev) => {
            const next = [item, ...prev.filter((p) => p.id !== item.id)];
            saveHistory(next);
            return next;
          });
          setBusy(false);
          return;
        }
        if (s.status === "FAILED") {
          setError(s.error ?? "生成失敗");
          setBusy(false);
          return;
        }
        // Provider may hand back a new id (e.g. preview -> refine chain).
        pollRef.current = window.setTimeout(() => poll(s.taskId, kind), POLL_MS);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => stopPolling, [stopPolling]);

  const canSubmit = mode === "text" ? prompt.trim().length > 0 : file !== null;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setError(null);
    setBusy(true);
    setTask({ taskId: "", status: "PENDING", progress: 0, stage: "送出任務" });
    labelRef.current = mode === "text" ? prompt.trim() : file?.name.replace(/\.[^.]+$/, "") || "image";
    const form = new FormData();
    if (mode === "image" && file) form.set("image", file);
    if (prompt.trim()) form.set("prompt", prompt.trim());
    try {
      const { taskId, kind } = await createTask(form);
      poll(taskId, kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setTask(null);
    }
  };

  const cancel = () => {
    stopPolling();
    setBusy(false);
    setTask(null);
  };

  const removeHistory = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveHistory(next);
      return next;
    });
    if (current?.id === id) setCurrent(null);
  };

  const viewerUrl = current ? toViewerUrl(current.modelUrl) : null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      {/* ---------- Sidebar ---------- */}
      <aside className="flex w-full flex-col gap-4 border-t p-4 lg:h-full lg:w-[380px] lg:overflow-y-auto lg:border-t-0 lg:border-r" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <header>
          <h1 className="text-xl font-semibold tracking-tight">3D Studio</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>輸入描述或上傳圖片，自動生成 3D 模型。</p>
          {demo && (
            <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,196,0,.08)", color: "#ffd166", border: "1px solid rgba(255,196,0,.25)" }}>
              示範模式：尚未設定 <code>MESHY_API_KEY</code>，會回傳內建範例模型。
            </div>
          )}
        </header>

        <div className="flex rounded-lg p-1" style={{ background: "var(--panel-2)" }}>
          {(["text", "image"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={busy}
              className="flex-1 rounded-md py-1.5 text-sm font-medium transition"
              style={mode === m ? { background: "var(--panel)", color: "var(--text)" } : { color: "var(--muted)" }}
            >
              {m === "text" ? "✍️ 文字建模" : "🖼️ 圖片建模"}
            </button>
          ))}
        </div>

        {mode === "image" && <ImageDrop file={file} onChange={setFile} disabled={busy} />}

        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--muted)" }}>
            {mode === "text" ? "描述你想要的模型" : "補充描述（選填，影響貼圖風格）"}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
            disabled={busy}
            rows={mode === "text" ? 5 : 2}
            maxLength={800}
            placeholder={mode === "text" ? "例如：一隻低多邊形風格的橘色小狐狸，坐著" : "例如：金屬材質、卡通風格"}
            className="w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-[color:var(--accent)]"
            style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}
          />
          {mode === "text" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" disabled={busy} onClick={() => setPrompt(ex)} className="btn-ghost rounded-full px-2.5 py-1 text-xs">
                  {ex.length > 18 ? ex.slice(0, 18) + "…" : ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {busy ? (
          <button type="button" onClick={cancel} className="btn-ghost rounded-xl py-2.5 text-sm font-medium">停止等待</button>
        ) : (
          <button type="button" onClick={submit} disabled={!canSubmit} className="btn-primary rounded-xl py-2.5 text-sm font-semibold">
            🚀 開始建模 <span className="ml-1 text-xs opacity-70">⌘/Ctrl + Enter</span>
          </button>
        )}

        {task && busy && (
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}>
            <div className="flex items-center justify-between text-xs">
              <span>{task.stage ?? (task.status === "PENDING" ? "排隊中" : "生成中")}</span>
              <span style={{ color: "var(--muted)" }}>{task.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div className="progress-bar h-full rounded-full" style={{ width: `${Math.max(3, task.progress)}%` }} />
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>通常需要 1 到 5 分鐘，完成後會自動顯示。</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(255,107,107,.08)", color: "var(--danger)", border: "1px solid rgba(255,107,107,.3)" }}>
            {error}
          </div>
        )}

        {history.length > 0 && (
          <section className="mt-auto">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>歷史紀錄</h2>
            <ul className="flex flex-col gap-1.5">
              {history.map((h) => (
                <li key={h.id} className="group flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: current?.id === h.id ? "var(--accent)" : "var(--border)", background: "var(--panel-2)" }}>
                  <button type="button" onClick={() => setCurrent(h)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {h.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded text-base" style={{ background: "var(--panel)" }}>{h.kind === "text" ? "✍️" : "🖼️"}</div>
                    )}
                    <span className="truncate">{h.label || "(未命名)"}</span>
                  </button>
                  <button type="button" onClick={() => removeHistory(h.id)} className="opacity-0 transition group-hover:opacity-100" style={{ color: "var(--muted)" }} aria-label="刪除">✕</button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      {/* ---------- Viewer ---------- */}
      <main className="relative order-first h-[55vh] shrink-0 lg:order-none lg:h-auto lg:flex-1">
        <ModelViewer url={viewerUrl} settings={settings} resetKey={resetKey} />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto max-w-[60%] truncate rounded-lg px-3 py-1.5 text-sm" style={{ background: "rgba(18,21,28,.8)", border: "1px solid var(--border)", backdropFilter: "blur(6px)" }}>
            {current ? current.label || "(未命名)" : "尚未產生模型"}
          </div>
          <div className="pointer-events-auto flex flex-wrap gap-1.5">
            <Tool label="自動旋轉" active={settings.autoRotate} onClick={() => setSettings((s) => ({ ...s, autoRotate: !s.autoRotate }))} />
            <Tool label="線框" active={settings.wireframe} onClick={() => setSettings((s) => ({ ...s, wireframe: !s.wireframe }))} />
            <Tool label={settings.background === "dark" ? "淺色背景" : "深色背景"} onClick={() => setSettings((s) => ({ ...s, background: s.background === "dark" ? "light" : "dark" }))} />
            <Tool label="重置視角" onClick={() => setResetKey((k) => k + 1)} />
            {current && (
              <a href={toDownloadUrl(current.modelUrl, current.label || "model")} download={`${current.label || "model"}.glb`} className="btn-primary rounded-lg px-3 py-1.5 text-sm font-medium">
                ⬇ 下載 GLB
              </a>
            )}
          </div>
        </div>

        {!current && !busy && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm" style={{ color: "var(--muted)" }}>
            在左側輸入描述或上傳圖片，開始建模。滑鼠拖曳旋轉、滾輪縮放、右鍵平移。
          </div>
        )}
      </main>
    </div>
  );
}

function Tool({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-active={active ?? false} className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
      {label}
    </button>
  );
}
