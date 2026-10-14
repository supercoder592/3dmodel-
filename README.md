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

## 三種引擎

| 引擎 | 費用 | 需要什麼 | 適合 |
| --- | --- | --- | --- |
| **Hunyuan3D（自架）** | 免費，不限次數 | 一張 NVIDIA GPU（10GB VRAM 只做形狀；約 29GB 做形狀 + PBR 貼圖） | 想擺脫 credits / token 限制 |
| **Meshy API** | 每次生成扣 credits | `MESHY_API_KEY` | 沒有 GPU、量少 |
| **示範模式** | 免費 | 不用設定 | 開發 UI |

引擎由環境變數決定（`MODEL_PROVIDER=auto` 時：有 `HUNYUAN_URL` 用自架，否則有 `MESHY_API_KEY` 用 Meshy，否則示範）。
左上角會顯示目前引擎與後端連線狀態，`GET /api/health` 也能查。

## 快速開始（網頁）

```bash
npm install
cp .env.example .env.local   # 依下面說明填入
npm run dev                  # http://localhost:3000
```

## 自架 Hunyuan3D：解決 token 問題

[Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) 是騰訊開源的圖片轉 3D 模型（含 PBR 貼圖），
品質與 Meshy 同一等級，跑在自己的 GPU 上就沒有 credits 的問題。

### 硬體

- Linux + NVIDIA GPU，CUDA 12.x 驅動，Python 3.10
- VRAM：只做形狀約 10GB（`HUNYUAN_TEXTURE=0`）；形狀 + 貼圖約 29GB（RTX 3090 / 4090 24GB 請開 `HUNYUAN_LOW_VRAM=1` 或關貼圖）
- 磁碟：模型權重約 30GB，第一次啟動會從 Hugging Face 下載
- 沒有 GPU 的話可租雲端 GPU（RunPod、Vast.ai、Lambda 等，RTX 4090 約每小時 US$0.3 到 0.7），把 `HUNYUAN_URL` 指到那台機器即可

### 安裝與啟動

```bash
bash server/setup_hunyuan.sh   # clone 官方 repo、建 venv、裝相依、編譯貼圖用的 CUDA 擴充
bash server/start.sh           # 啟動 Hunyuan3D API (:8081) 與文字轉圖片 sidecar (:7860)
```

然後在 `.env.local` 設定：

```
HUNYUAN_URL=http://127.0.0.1:8081
T2I_URL=http://127.0.0.1:7860
```

### 文字建模怎麼做到的

Hunyuan3D 本身只吃圖片。文字建模走兩步：

1. **文字 → 參考圖**：`server/t2i_server.py`（預設 SDXL-Turbo，4 步、約 1 秒），會自動加上「單一物體、置中、白底、3D 渲染」等提示詞。
   如果你已經有開 `--api` 的 AUTOMATIC1111 / Forge，直接把 `T2I_URL` 指過去就好，介面相容。
   想要更好的文字理解可設 `T2I_MODEL=black-forest-labs/FLUX.1-schnell`（需要約 24GB VRAM）。
2. **參考圖 → 3D**：送進 Hunyuan3D。參考圖會存成縮圖顯示在歷史紀錄裡。

> 中文 prompt：SDXL-Turbo 對英文理解較好，中文描述建議簡短或改用英文；FLUX 對中文的容忍度較高。

### 相關環境變數

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `HUNYUAN_URL` | — | Hunyuan3D `api_server.py` 位址 |
| `HUNYUAN_TEXTURE` | `1` | `0` 只做形狀（快很多、VRAM 少） |
| `HUNYUAN_OCTREE_RESOLUTION` | `256` | 網格解析度，越高越細、越慢 |
| `HUNYUAN_STEPS` | `30` | 擴散步數 |
| `HUNYUAN_TIMEOUT_SEC` | `1800` | 超過視為失敗（官方 API 失敗時不會回報，靠這個收尾） |
| `T2I_URL` | — | 文字轉圖片服務；沒設只能用圖片建模 |
| `T2I_STEPS` / `T2I_SIZE` / `T2I_CFG` | `4` / `768` / `1` | SDXL-Turbo 建議值；用 SDXL base 改 `25` / `1024` / `7` |
| `DATA_DIR` | `data` | 產出的 GLB 與縮圖存放處 |

### 授權注意

Hunyuan3D 2.1 採 Tencent Hunyuan 3D 2.1 Community License：可商用，
但月活躍用戶超過 100 萬需另向騰訊申請，且**不適用於歐盟、英國、南韓**。
對外提供服務時要揭露你的公司名稱並註明與騰訊無關。細節以 [LICENSE](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE) 為準。

## Meshy API

| 變數 | 說明 |
| --- | --- |
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
│     ├─ model/route.ts         # 代理遠端 GLB（避免 CORS、限制白名單網域）
│     ├─ files/[name]/route.ts  # 提供自架引擎產出的 GLB / 縮圖
│     └─ health/route.ts        # 目前引擎與後端連線狀態
├─ lib/
│  ├─ providers/
│  │  ├─ types.ts               # ModelProvider 介面
│  │  ├─ hunyuan.ts             # 自架 Hunyuan3D（/send、/status）
│  │  ├─ meshy.ts               # Meshy text-to-3d / image-to-3d
│  │  ├─ mock.ts                # 離線示範
│  │  └─ index.ts               # 依環境變數選擇 provider
│  ├─ text-to-image.ts          # 文字 → 參考圖（A1111 相容介面）
│  └─ client.ts                 # 前端 fetch / localStorage 小工具
server/
├─ setup_hunyuan.sh             # 安裝官方 Hunyuan3D 2.1
├─ start.sh                     # 啟動 Hunyuan3D API + 文字轉圖片 sidecar
├─ t2i_server.py                # SDXL-Turbo 文字轉圖片（A1111 相容）
└─ requirements-t2i.txt
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
例如 Tripo3D、TRELLIS、Replicate / fal.ai 上的按秒計費模型。遠端 GLB 要加進 `/api/model` 的網域白名單。

## 指令

```bash
npm run dev        # 開發
npm run build      # 正式建置
npm run start      # 啟動正式伺服器
npm run typecheck  # TypeScript 檢查
```

## 部署

標準 Next.js 專案，可直接部署到 Vercel / Netlify / 任何 Node 環境。
自架引擎需要 Node 常駐環境與可寫的 `DATA_DIR`（Vercel 這類無狀態平台不適合存檔，請改放 GPU 主機或一般 VPS）。
Meshy 模式則任何平台都可以，記得設定 `MESHY_API_KEY`。圖片以 base64 傳送，單張上限 20MB。
