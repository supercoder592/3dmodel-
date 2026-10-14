# 3D Studio — 文字 / 圖片 自動建模

輸入一段描述，或拖一張圖片進來，網頁會自動呼叫 3D 生成 API 產生模型，
在瀏覽器裡用 three.js 即時預覽，並可下載 GLB。

## 功能

- ✍️ **文字建模**：輸入 prompt（中英文皆可）→ 產生形狀 → 自動接著產生貼圖
- 🖼️ **圖片建模**：拖曳 / 貼上 / 選擇 PNG、JPG、WebP → 產生帶貼圖的模型
- 🧊 **3D 預覽**：旋轉、縮放、平移、自動旋轉、線框、深 / 淺色背景、重置視角
- ⬇️ **下載 GLB**：可直接匯入 Blender、Unity、Unreal、three.js
- 🕘 **歷史紀錄**：存在瀏覽器 localStorage，可隨時切回之前的模型
- 🧪 **示範模式**：沒有 API Key 也能跑，會回傳內建範例模型方便開發 UI

## 快速開始

```bash
npm install
cp .env.example .env.local   # 填入 MESHY_API_KEY
npm run dev                  # http://localhost:3000
```

沒填 `MESHY_API_KEY` 時會自動進入示範模式（畫面上方會有黃色提示）。

## 環境變數

| 變數 | 說明 |
| --- | --- |
| `MODEL_PROVIDER` | `meshy`（預設）或 `mock` |
| `MESHY_API_KEY` | 到 https://www.meshy.ai 申請 |
| `MESHY_SKIP_REFINE` | 設為 `1` 時文字建模只做形狀、不做貼圖（較快、較省 credits） |

## 架構

```
src/
├─ app/
│  ├─ page.tsx                  # 入口，判斷是否示範模式
│  └─ api/
│     ├─ generate/route.ts      # POST 建立任務（JSON 或 multipart）
│     ├─ tasks/[id]/route.ts    # GET 查詢進度，回傳統一格式
│     └─ model/route.ts         # 代理遠端 GLB（避免 CORS、限制白名單網域）
├─ lib/
│  ├─ providers/
│  │  ├─ types.ts               # ModelProvider 介面
│  │  ├─ meshy.ts               # Meshy text-to-3d / image-to-3d
│  │  ├─ mock.ts                # 離線示範
│  │  └─ index.ts               # 依環境變數選擇 provider
│  └─ client.ts                 # 前端 fetch / localStorage 小工具
└─ components/
   ├─ Studio.tsx                # 主畫面：輸入面板 + 進度 + 歷史
   ├─ ImageDrop.tsx             # 圖片拖放區
   └─ ModelViewer.tsx           # react-three-fiber 檢視器
```

### 流程

1. 前端把 prompt / 圖片 `POST /api/generate`，後端轉成 provider 的任務，回傳 `taskId`。
2. 前端每 2.5 秒 `GET /api/tasks/:id`。Meshy 文字建模分兩段（preview → refine），
   後端在 preview 完成時自動建立 refine 任務並回傳新的 `taskId`，前端接著輪詢新的 id。
3. `status === "SUCCEEDED"` 時取得 `modelUrl`，前端透過 `/api/model?url=…` 載入 GLB。

### 換其他 3D 生成服務

實作 `ModelProvider` 介面（`createTask` / `getTask`）並在 `providers/index.ts` 註冊即可，
例如 Tripo3D、Hunyuan3D（Replicate）、Stability 等。`/api/model` 的白名單也要加上該服務的 CDN 網域。

## 指令

```bash
npm run dev        # 開發
npm run build      # 正式建置
npm run start      # 啟動正式伺服器
npm run typecheck  # TypeScript 檢查
```

## 部署

標準 Next.js 專案，可直接部署到 Vercel / Netlify / 任何 Node 環境。
記得在平台上設定 `MESHY_API_KEY`。圖片會以 base64 傳給 Meshy，單張上限 20MB。
