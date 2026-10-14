"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

export default function ImageDrop({ file, onChange, disabled }: { file: File | null; onChange: (f: File | null) => void; disabled?: boolean }) {
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (!ACCEPT.includes(f.type)) return;
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(f));
      onChange(f);
    },
    [onChange, preview],
  );

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className="dropzone relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-3 text-center text-sm transition"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      data-drag={drag}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) pick(e.dataTransfer.files?.[0]); }}
      onPaste={(e) => { const f = Array.from(e.clipboardData.files)[0]; if (f) pick(f); }}
    >
      <input ref={inputRef} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} disabled={disabled} />
      {file && preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="預覽" className="max-h-56 rounded-lg object-contain" />
          <div className="mt-2 truncate text-xs" style={{ color: "var(--muted)" }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</div>
          {!disabled && (
            <button type="button" onClick={(e) => { e.stopPropagation(); clear(); }} className="absolute right-2 top-2 rounded-md px-2 py-1 text-xs btn-ghost">移除</button>
          )}
        </>
      ) : (
        <>
          <div className="text-2xl">🖼️</div>
          <div className="mt-1">拖曳、貼上或點擊選擇圖片</div>
          <div className="mt-1 text-xs opacity-70">PNG / JPG / WebP，最大 20MB。單一物體、乾淨背景效果最好。</div>
        </>
      )}
    </div>
  );
}
