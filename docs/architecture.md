# 架構

本檔描述分層、模組職責、資料流與檔案格式。需求定義見 `docs/requirements.md`，詞彙定義見 `docs/glossary.md`。

## 1. 執行環境

| 項目 | 值 |
|---|---|
| 桌面框架 | Neutralinojs v6.10.0 |
| CLI | `@neutralinojs/neu` 11.8.0 |
| 前端建置 | Vite + TypeScript |
| 測試 | vitest |
| 平台 | Windows |

Neutralino 的設定檔 `neutralino.config.json` **必須位於專案根目錄**。

## 2. 分層

依賴方向單向，不得反向或跨層。

```
        ┌──────────────────────────────────────┐
        │  src/ui/                             │
        │  TableView · EditControls · StatusBar│
        │  theme.css · scale.ts                │
        └──────────────┬───────────────────────┘
                       │ 只能往下
        ┌──────────────▼───────────────────────┐
        │  src/services/                       │
        │  QuoteService · MisProvider          │
        │  YahooProvider · symbolTable         │
        │  storage · logger                    │
        └──────────────┬───────────────────────┘
                       │ 只能往下
        ┌──────────────▼───────────────────────┐
        │  src/domain/          零依賴          │
        │  types · quote · pnl · format        │
        │  validate                            │
        └──────────────────────────────────────┘
```

**`src/domain/` 不得出現任何報價來源的欄位名。** 它只認 `Quote` 型別。所有 MIS / Yahoo 的回應解析都必須發生在 `src/services/`，並在進入 domain 前轉換完成。這是為了讓唯一脆弱的非官方依賴（MIS）可被單點替換。

## 3. 模組職責

### 3.1 domain（零依賴）

| 檔案 | 職責 |
|---|---|
| `types.ts` | `Holding`、`Quote`、`QuoteTarget`、`SymbolEntry`、`Market`、`QuoteSource`、`QuoteBatch`、`SortKey`、`SortDirection`、`UiPreferences` |
| `quote.ts` | 解析來源價數字串、由正規化輸入建構 `Quote`（估值價、是否有成交）、資料日期是否非當日 |
| `pnl.ts` | 總報酬、今日報酬、市值、投組總計（含缺值排除與排除檔數） |
| `format.ts` | 千分位、價格 2 位、金額 0 位、報酬率 2 位加 `%`、缺值 `—`、漲跌語意 |
| `validate.ts` | 代號格式、股數正整數、成本正數 |

報價來源的欄位名（`trade.z`、`z`、`c`、`y`、`d`）只出現在 `services/quote/MisProvider.ts`。`domain/` 只接收已正規化的 `number | null` 與字串，因此 F5 的現價解析順序實作於 provider，其單元測試也放在 `src/services/`。

### 3.2 services

| 檔案 | 職責 |
|---|---|
| `http.ts` | 唯一的傳輸出口。`getText(url)` 依環境變數選 `net.get` 或 `curl.exe`，統一回傳 `{ status, body }` |
| `clock.ts` | 本地時間文字（`YYYY-MM-DD`、`YYYYMMDD`、`HH:mm:ss`）與交易時段判斷 |
| `fsutil.ts` | `ensureDirectory`，把 `NE_FS_DIRCRER` 視為成功 |
| `quote/QuoteProvider.ts` | `QuoteProvider` 介面 |
| `quote/QuoteService.ts` | 交易時段判斷、輪詢排程、失敗計數、降級、回試、狀態廣播 |
| `quote/MisProvider.ts` | 組 `ex_ch` 批次字串、呼叫 MIS、解析回應、現價解析順序（`trade.z` → `z` → 當日無成交）、壞代號判定（`c === ""`）、正規化為 `Quote` |
| `quote/YahooProvider.ts` | 代號轉 `.TW` / `.TWO`、解析 `v8/chart`、正規化為 `Quote` |
| `symbolTable.ts` | 抓取並合併兩個官方端點、讀寫 `config/symbols.json`、代號查詢 |
| `storage.ts` | 讀寫 `config/portfolio.json`、`schemaVersion` 遷移 |
| `logger.ts` | 寫入 `logs/app.log`，只記異常與狀態轉換 |

### 3.3 ui

| 檔案 | 職責 |
|---|---|
| `theme.css` | 深色 design token（CSS 變數）、紅漲綠跌色票 |
| `scale.ts` | 監聽 DOM `resize`，更新縮放用的 CSS 變數 |
| `TableView.ts` | 9 欄表格、欄頭排序、總計列、無成交列淡化 |
| `EditControls.ts` | 新增 / 編輯 / 刪除（二次確認）、強制新增逃生門 |
| `StatusBar.ts` | 更新時間、來源標籤、降級警示、非當日資料標記 |

## 4. 關鍵介面

```ts
export type Market = 'listing' | 'otc'

export interface Quote {
  code: string
  /** 現價。null 代表當日無成交，UI 顯示 "—" */
  price: number | null
  /** 計算用的估值價。無成交時等於 previousClose；兩者皆缺時為 null */
  valuationPrice: number | null
  previousClose: number | null
  traded: boolean
  /** 資料日期，YYYYMMDD */
  dataDate: string
}

export interface QuoteBatch {
  source: 'mis' | 'yahoo'
  quotes: Quote[]
  fetchedAt: string
}

export interface QuoteProvider {
  readonly kind: 'mis' | 'yahoo'
  fetchQuotes(targets: { code: string; market: Market }[]): Promise<QuoteBatch>
}
```

`domain/` 完全不知道 `QuoteProvider` 的存在；`QuoteService` 是唯一決定「用哪個 provider」的地方。`ui/` 只向 `QuoteService` 訂閱狀態與資料。

## 5. 資料流

### 5.1 啟動

```
main.ts
  → storage.load()                    讀 config/portfolio.json
  → symbolTable.ensureFresh()         非當日則抓兩個官方端點
  → ui 建立（套用排序、視窗尺寸、主題、縮放）
  → QuoteService.start()
        若在交易時段 → 立即抓一次，之後每 5 秒
        若不在      → 抓一次即停，狀態列顯示「已收盤 / 非交易時段」
```

### 5.2 輪詢循環

```
每 5 秒（僅交易時段）
  → QuoteService 組成 targets（code + market）
  → 當前 provider.fetchQuotes(targets)
        MisProvider   : ex_ch=tse_2330.tw|otc_6488.tw|...  一次請求
        YahooProvider : 逐檔 .TW / .TWO（無批次端點）
        provider 一律經 services/http.ts 取字串，不知道實際傳輸方式
  → 正規化為 QuoteBatch（services 層完成解析）
  → 成功：domain/pnl 計算 → ui 重繪 → 狀態列更新時間
    失敗：failCount++；達 3 次 → 切換為 YahooProvider、狀態列轉警示、寫 log
  → 降級中每 5 分鐘試回 MIS，成功即恢復、寫 log
  → 13:30 後補抓一次確認收盤價 → 停止輪詢
```

### 5.3 編輯

```
使用者切到編輯模式
  → 新增：輸入代號 → symbolTable.lookup()
        命中 → 帶入 name / market
        未命中 → 顯示強制新增逃生門（自選 market + 自填 name）
  → validate → storage.save() → QuoteService 更新 targets（不需重啟）
  → 刪除：二次確認（顯示代號與名稱）→ storage.save() → 移出 targets
```

## 6. 檔案格式

### 6.1 `config/portfolio.json`

```json
{
  "schemaVersion": 1,
  "sortKey": "marketValue",
  "sortDirection": "desc",
  "windowWidth": 1100,
  "windowHeight": 760,
  "holdings": [
    { "code": "2330", "name": "台積電", "market": "listing", "shares": 1000, "averageCost": 850.5 }
  ]
}
```

`schemaVersion` 供日後遷移使用，載入時若版本不符則執行遷移後回寫。

### 6.2 `config/symbols.json`

```json
{
  "updatedAt": "2026-10-16",
  "entries": [
    { "code": "2330", "name": "台積電", "market": "listing" },
    { "code": "6488", "name": "環球晶", "market": "otc" }
  ]
}
```

### 6.3 `logs/app.log`

單行格式，含時間、層級、事件、細節。僅記錄異常與狀態轉換。

## 7. Neutralino 設定要點

### 7.1 視窗

```json
"modes": {
  "window": {
    "title": "Stock Portfolio",
    "width": 1100,
    "height": 760,
    "minWidth": 700,
    "minHeight": 480,
    "resizable": true,
    "useSavedState": false
  }
}
```

`useSavedState` 設為 `false`：視窗尺寸由 `portfolio.json` 自行管理，避免兩套來源打架。

**已知限制**：

- 沒有 aspect ratio 鎖定 → 見 ADR-0006
- 沒有 `windowResize` 事件 → 使用 DOM `resize` 監聽
- 沒有 `window.setPosition` → 若需移動視窗用 `window.move(x, y)`
- `window.setSize` 的 `minWidth` 必須與 `minHeight` 成對提供

### 7.2 前端工具鏈

Vite 沒有官方模板（`neutralinojs/neutralinojs-vite-template` 已 404），因此取 `neutralinojs/neutralinojs-zero` 骨架後手動接入。

**輸出目錄必須分開**：`neu build` 預設輸出到 `dist/`（執行檔 + `resources.neu`），可用 `cli.distributionPath` 覆寫。本專案保留預設值，因此 Vite 的 `outDir` 設為 `build/`，`documentRoot` 與 `resourcesPath` 都指向 `/build/`。兩者共用 `dist/` 會互相覆蓋。決策與替代方案見 ADR-0010。

```json
"documentRoot": "/build/",
"cli": {
  "binaryName": "stock-portfolio",
  "binaryVersion": "6.10.0",
  "resourcesPath": "/build/",
  "frontendLibrary": {
    "devUrl": "http://localhost:5173",
    "projectPath": "/",
    "initCommand": "npm install",
    "devCommand": "npm run dev",
    "buildCommand": "npm run build"
  }
}
```

- 不設 `cli.clientLibrary`，改由 npm 安裝 `@neutralinojs/lib`，避免 CLI 從 GitHub Releases 取客戶端程式庫
- 搭配 `modes.window.injectGlobals: true`，框架會直接注入全域變數，因此**不需要** `frontendLibrary.patchFile`（`patchFile` 是給不使用 `injectGlobals` 的專案用的）
- Vite 的 `publicDir` 設為 `resources`，因此 `resources/**` 會原樣複製到 `build/`。視窗圖示路徑因此是 `/build/icons/appIcon.png`
- `neu run` 會執行 `devCommand`、等待 `devUrl` 的埠就開、再啟動應用程式並帶上 `--url`。Vite 的 `strictPort: true` 是必要的，否則埠被占用時會換埠而 CLI 等不到

### 7.3 檔案系統

- `dataLocation: "app"`（預設）：資料留在應用程式目錄，符合 ADR-0004
- `filesystemScopes` **必須留空或省略**。v6.10.0 新增此限制，設定後範圍外的檔案存取會以 `NE_FS_SCOPERR` 失敗
- `filesystem.createDirectory` 自 v5.0.0 起支援遞迴建目錄；`writeFile` **不保證**自動建立父目錄，寫入前一律先呼叫 `createDirectory`
- **`createDirectory` 在目錄已存在時會回報 `NE_FS_DIRCRER`**（實測）。因此呼叫端必須把這個錯誤碼視為成功，否則第二次啟動就會失敗。`storage.ts` 與 `logger.ts` 都必須處理

### 7.4 網路

- 傳輸細節集中在 `src/services/http.ts`，主傳輸為 `Neutralino.net.get(url, options)`。**`Neutralino.net.fetch` 不存在**
- 回傳 `{ status, statusText, body, headers, cookies, contentType, location, version }`
- `body` 是**字串**，需自行 `JSON.parse`
- 框架層 C++ 實作，繞過 webview 的 CORS（已實測：webview 對 `http://127.0.0.1:5173` 的請求回 200）
- `allowRedirects` 預設 `false`
- **型別定義與框架不一致**：`@neutralinojs/lib` 6.10.0 把 `encodePath` 與 `keepAlive` 宣告為必填，且把 `timeout` 宣告成 `boolean`。呼叫時必須提供 `encodePath` 與 `keepAlive` 才能通過型別檢查
- **不支援 proxy**，因此需要第二條傳輸。見 ADR-0009

#### net API 不走系統 proxy，因此有第二條傳輸路徑

實測結果（2026-10-16）：

| 呼叫方式 | 結果 |
|---|---|
| `Neutralino.net.get` → `http://127.0.0.1:5173` | 200 |
| `Neutralino.net.get` → `https://mis.twse.com.tw` | 逾時（20 秒無回應） |
| `curl.exe`（繼承 `HTTPS_PROXY`）→ 同上 | 0.8 秒，200 |
| `curl.exe --noproxy "*"` → 同上 | 逾時 |
| `node fetch`（無設定）→ 同上 | `TypeError: fetch failed` |
| `node fetch` + `NODE_USE_ENV_PROXY=1` → 同上 | 200 |

`net.request` 的選項中沒有任何 proxy 欄位，框架也沒有對應的啟動參數。`HTTPS_PROXY` 在本機是機器層級環境變數，因此每個子行程都繼承得到。

`src/services/http.ts` 是唯一的傳輸出口，`getText(url)` 提供 `{ status, body }`：

| 條件 | 傳輸 |
|---|---|
| 未設 `HTTPS_PROXY` / `HTTP_PROXY` | `Neutralino.net.get(url, { encodePath: true, keepAlive: false, timeout: <毫秒> })` |
| 已設 `HTTPS_PROXY` / `HTTP_PROXY` | `Neutralino.os.execCommand('curl.exe -s -i -m <秒數> "<url>"')`，剝除開頭的標頭區塊後取狀態碼與本文 |

`net.get` 的 `timeout` 在 6.10.0 的型別中宣告為 `boolean`，框架實際要毫秒數字，呼叫時以轉型帶入。`os.execCommand` 沒有逾時參數，這條路徑的逾時由 `curl.exe -m` 負責。

**`curl.exe -i` 會輸出多個標頭區塊。** 走 proxy 的 HTTPS 連線先吐 `HTTP/1.1 200 Connection established`，之後才是真正的回應。因此 `getText` 連續剝除開頭的標頭區塊，狀態碼取自最後一個標頭區塊的第一行，其後即為本文。

首選傳輸在啟動時決定一次並固定。provider 只做回應解析，不知道實際走哪條路。理由與替代方案見 ADR-0009。

## 8. 錯誤處理

| 情境 | 處理 |
|---|---|
| 網路失敗 | 計入失敗次數，不中斷輪詢；畫面保留上一次的報價並沿用其時間戳 |
| MIS 連續失敗 3 次 | 降級 Yahoo，狀態列轉警示 |
| MIS 回傳佔位物件（`c === ""`） | 該代號標為查無資料，不影響同批次其他代號 |
| `z === "-"` | 當日無成交 → 顯示 `—`、整列淡化、計算改用昨收 |
| `y` 缺失 | 估值價為 `null` → 報酬欄顯示 `—`、該列排除於總計 |
| `portfolio.json` 損毀 | 拒絕覆寫，log 記錄，UI 顯示錯誤並保留原檔 |
| `symbols.json` 過期且更新失敗 | 沿用舊快取，log 記錄，不阻擋啟動 |
| 非交易日啟動 | 抓一次即停，狀態列顯示「非交易時段」 |

## 9. ADR 索引

| 編號 | 決策 |
|---|---|
| [ADR-0001](adr/ADR-0001.md) | 報價來源採 MIS，Yahoo 為備援 |
| [ADR-0002](adr/ADR-0002.md) | 庫存模型只存平均單位成本 |
| [ADR-0003](adr/ADR-0003.md) | 報酬率公式（未實現、不含費稅股利） |
| [ADR-0004](adr/ADR-0004.md) | 儲存於 `config/` 下的單一 JSON |
| [ADR-0005](adr/ADR-0005.md) | TypeScript + Vite，不引入框架 |
| [ADR-0006](adr/ADR-0006.md) | 縮放改用內容等比 |
| [ADR-0007](adr/ADR-0007.md) | 固定深色主題，紅漲綠跌 |
| [ADR-0008](adr/ADR-0008.md) | 視窗尺寸與輪詢時段 |
| [ADR-0009](adr/ADR-0009.md) | 報價傳輸以 `net.get` 為主，`curl.exe` 為備援 |
| [ADR-0010](adr/ADR-0010.md) | Vite 產出放 `build/`，globals 由框架注入 |
