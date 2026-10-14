import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Studio — 文字 / 圖片 自動建模",
  description: "輸入描述或上傳圖片，自動生成可下載的 3D 模型（GLB）。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
