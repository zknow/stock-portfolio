# Stock Portfolio

檢視自己台股庫存的桌面應用程式。單機、單人使用，不涉及下單。

- 追蹤持股的即時價格與投資報酬率（總報酬 / 今日報酬）
- 新增、刪除股票，更新股數與平均單位成本
- 檢視模式與編輯模式切換，避免誤觸修改
- 固定深色介面，欄寬貼齊內容、視窗尺寸由內容決定，可自由拖拉；`Ctrl+=` / `Ctrl+-` / `Ctrl+滾輪` 縮放（80%–200%，倍率會記住）

## 技術

| 項目 | 選擇 |
|---|---|
| 桌面框架 | Neutralinojs v6.10.0（CLI `@neutralinojs/neu` 11.8.0） |
| 前端 | TypeScript + Vite，不引入 UI 框架 |
| 測試 | vitest（`src/domain` 與 `src/ui` 的純函式、`src/services` 以 mock 隔離 Neutralino API） |
| 平台 | Windows |

## 報價來源

| 角色 | 來源 |
|---|---|
| 主 | `mis.twse.com.tw` 即時報價，5 秒批次輪詢，僅交易時段 09:00–13:30 |
| 備援 | Yahoo Finance `v8/chart`（延遲約 20 分鐘），連續 3 次失敗後接手 |
| 標的清單 | TWSE `STOCK_DAY_ALL` + TPEx `tpex_mainboard_quotes`，每日更新一次 |

選擇理由與風險見 `docs/adr/ADR-0001`。

## 執行

### 前置作業

```bash
npm install
```

`bin/neutralino-win_x64.exe` 是 Neutralino 框架執行檔，已納入版控，clone 後不需額外取得。它的版本必須等於 `neutralino.config.json` 的 `cli.binaryVersion`。

雙擊 `scripts\start.bat` 或 `scripts\release.bat` 時不必先手動跑：找不到 `node_modules\` 會自己執行 `npm install`，失敗才停下來顯示訊息。

### 啟動

```bash
npx neu run
```

或雙擊 `scripts\start.bat`；要開發者工具時執行 `scripts\start.bat inspector`。用 `start.bat` 啟動時，關掉應用程式視窗（右上角 X）會連同主控台、`neu run` 與 Vite 一起結束。

三支 `.bat` 以 ANSI（CP950 / Big5）儲存，不要改存成 UTF-8：cmd 以主控台代碼頁解碼批次檔，UTF-8 的中文會被錯讀。

### 包版（release）

```bash
npx neu build --release
```

或雙擊 `scripts\release.bat`。產物在 `dist/stock-portfolio/`：`stock-portfolio-win_x64.exe` 與 `resources.neu`，另有 `dist/stock-portfolio-release.zip`。

打包後的 exe 以**行程的工作目錄**解析 `config/` 與 `logs/` 這類相對路徑。雙擊執行時工作目錄等於 exe 所在目錄，資料就在 exe 旁邊；若從其他目錄啟動（例如 `Start-Process` 未指定 `-WorkingDirectory`），資料會落在該目錄。`dist/stock-portfolio/neutralinojs.log` 是框架自己的日誌，與應用程式的 `logs/app.log` 無關。

### 清除殘留程序

`npx neu run` 或測試結束後若行程沒被關掉（`neutralino-win_x64.exe`、Vite / esbuild / vitest 的 `node.exe`），雙擊 `scripts\kill.bat` 清除；`scripts\start.bat` 啟動的 app 關閉時會自己跑這一步，不需手動。

判準只有兩類：執行檔位於本專案目錄下（`bin\`、`dist\`、`node_modules\`），或 `node.exe` 的命令列指向本專案的 `node_modules` 工具鏈（vite / vitest / esbuild / @neutralinojs）。其他 `node.exe`、開著本專案的編輯器與 agent 都不受影響；被結束的行程連同其子行程（webview 等）一併關閉。

### 目錄別名

| 目錄 | 內容 | 版控 |
|---|---|---|
| `build/` | Vite 的產出（前端 bundle） | 不納入 |
| `dist/` | `neu build` 的產出（執行檔 + `resources.neu`） | 不納入 |
| `bin/` | Neutralino 框架執行檔（`neu run` 需要） | 納入 |

### 網路

`Neutralino.net` 不支援 proxy。在需要 proxy 才能連外的網路環境，報價請求會逾時，此時 `src/services/http.ts` 會自動改走 `curl.exe`（繼承系統的 `HTTPS_PROXY`）。判準與細節見 [ADR-0009](docs/adr/ADR-0009.md)。

## 專案結構

```
stock-portfolio/
├── AGENTS.md                  # 專案操作規則（給 Agent 讀）
├── README.md
├── TODOLIST.md                # 實作進度追蹤
├── neutralino.config.json     # Neutralino 設定（必須在根目錄）
├── index.html                 # Vite 進入點
├── package.json
├── tsconfig.json
├── vite.config.ts
├── bin/                       # 框架執行檔（neu run 需要）
├── build/                     # Vite 產出（不納入版控）
├── dist/                      # neu build 產出（不納入版控）
├── config/                    # 設定檔（兩個 JSON 於首次執行時產生，不納入版控）
│   ├── portfolio.json         # 庫存與 UI 偏好
│   └── symbols.json           # 代號對照表快取
├── docs/                      # 規格文件
│   ├── requirements.md
│   ├── architecture.md
│   ├── glossary.md
│   └── adr/
├── logs/                      # 日誌檔
│   └── app.log
├── resources/                 # 其他資源（Vite 的 publicDir，會複製到 build/）
│   └── icons/appIcon.png
├── scripts/                   # 雙擊用的便利腳本
│   ├── start.bat              # 啟動桌面應用程式（缺 node_modules 先 npm install；關掉 app 後自動收尾）
│   ├── release.bat            # 打包 Windows 執行檔（缺 node_modules 先 npm install）
│   └── kill.bat               # 清除殘留的專案程序
└── src/                       # 原始程式碼
    ├── domain/                # 模型與計算，零依賴
    ├── services/              # 報價、儲存、對照表、日誌
    ├── ui/                    # 表格、編輯控制、狀態列、主題
    └── main.ts
```

## 文件導覽

| 文件 | 內容 |
|---|---|
| `docs/requirements.md` | 功能規格：每個功能的規則、驗證、邊界 |
| `docs/architecture.md` | 分層、模組職責、資料流、檔案格式、ADR 索引 |
| `docs/glossary.md` | 領域詞彙的單一定義來源 |
| `docs/adr/` | 十八篇技術決策紀錄（含理由與替代方案） |
| `AGENTS.md` | 專案操作規則 |
| `TODOLIST.md` | 實作順序與進度 |

## 範圍外

僅支援台股（上市 / 上櫃）。不含下單、不含手續費與證交稅、不含股利、不含交易明細與已實現損益、不含美股與海外市場。
