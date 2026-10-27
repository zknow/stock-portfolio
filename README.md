# Stock Portfolio

檢視自己台股庫存的桌面應用程式。單機、單人使用，不涉及下單。

<!-- 需作者補充：介面截圖。放到 docs/images/overview.png 後，取消下一行註解 -->
<!-- ![介面](docs/images/overview.png) -->

## 功能

- 追蹤持股的即時價格與投資報酬率（總報酬、今日報酬）
- 新增、刪除股票，更新股數與平均成本
- 檢視模式與編輯模式切換，避免誤觸修改
- 固定深色介面，視窗大小跟著內容走，欄寬可拖拉
- 縮放 80%–200%，倍率會記住

## 快速開始

### 直接執行打包好的 exe

1. 解壓 `stock-portfolio-release.zip`
2. 雙擊 `stock-portfolio-win_x64.exe`

資料會存在 `%APPDATA%\stock-portfolio\`。

### 從原始碼執行

需要 Windows 10/11 與 Node.js 22.12 以上。`git clone` 或下載 ZIP 解壓後，進到專案目錄執行：

```bash
npm install
npx neu run
```

`neu run` 會自己帶起 Vite，不用先開 `npm run dev`。框架執行檔 `bin/neutralino-win_x64.exe` 不納入版控，`start.bat` 與 `release.bat` 找不到時會依 `neutralino.config.json` 的 `binaryVersion` 自動下載（見 [ADR-0022](docs/adr/ADR-0022.md)）。

## 第一次使用

1. 按工具列「編輯」進入編輯模式
2. 按「新增股票」
3. 輸入代號（名稱會自動帶入）、股數、平均成本，按「新增」
4. 按「完成」回到檢視模式

## 操作

| 動作 | 方式 |
|---|---|
| 縮放 | `Ctrl+=`、`Ctrl+-`、`Ctrl+滾輪`，80%–200% |
| 切換模式 | 工具列「編輯」／「完成」 |
| 改股數或成本 | 編輯模式下點該格直接改 |
| 刪除持股 | 編輯模式下按該列的刪除 |

## 報價來源

| 角色 | 來源 |
|---|---|
| 主 | `mis.twse.com.tw`，盤中每 5 秒更新一次（09:00–13:30） |
| 備援 | Yahoo Finance，延遲約 20 分鐘，主來源連續 3 次失敗後接手 |
| 可選股票清單 | TWSE `STOCK_DAY_ALL` + TPEx `tpex_mainboard_quotes`，每天更新一次 |

非交易時段不會持續更新，啟動時抓一次就停。選擇理由與風險見 [ADR-0001](docs/adr/ADR-0001.md)。

## 資料位置與備份

| 檔案 | 內容 | 版控 |
|---|---|---|
| `%APPDATA%\stock-portfolio\portfolio.json` | 持股與介面偏好。複製這個檔就是備份 | 不納入 |
| `%APPDATA%\stock-portfolio\symbols.json` | 代號對照表快取，刪掉會自己重建 | 不納入 |
| `logs/app.log` | 異常與狀態轉換紀錄，用於排查 | 不納入 |

以上檔案都在首次執行時自動產生。舊版放在 `config/` 的檔案會在首次執行時複製到上述位置，原檔保留（ADR-0029）。

打包後的 exe 以行程的工作目錄解析相對路徑：解壓後直接雙擊，資料就在 exe 旁邊；從其他目錄啟動時，資料會寫到那個目錄。

## 已知限制

- 僅支援 Windows 與台股（上市／上櫃）
- 非交易時段價格不更新
- Yahoo Finance 備援延遲約 20 分鐘
- 公司網路需要 proxy 時 `Neutralino.net` 會逾時，程式會自動改走 `curl.exe`（繼承系統的 `HTTPS_PROXY`），細節見 [ADR-0009](docs/adr/ADR-0009.md)
- 不含下單、手續費、證交稅、股利、交易明細、已實現損益、美股與海外市場

## 開發

| 項目 | 選擇 |
|---|---|
| 桌面框架 | Neutralinojs v6（CLI `neu` v11） |
| 前端 | TypeScript + Vite，不引入 UI 框架 |
| 測試 | vitest |
| 平台 | Windows |

實際版號以 `package.json` 與 `neutralino.config.json` 為準。

```bash
npm run dev                 # Vite 開發伺服器
npm test                    # vitest
npx neu build --release     # 打包到 dist/stock-portfolio/
```

### 三支腳本

| 腳本 | 用途 |
|---|---|
| `scripts\start.bat` | 啟動桌面應用程式；加 `inspector` 參數附開發者工具；關掉 app 會一併收掉 `neu run` 與 Vite |
| `scripts\release.bat` | 打包 Windows 執行檔 |
| `scripts\prepare.bat` | 檢查 `bin\neutralino-win_x64.exe`，不存在時依 `binaryVersion` 下載；檢查 `node_modules\`，不存在時執行 `npm install`。`start.bat` 與 `release.bat` 會自動呼叫 |
| `scripts\kill.bat` | 清除殘留的專案程序；`start.bat` 啟動前後自動呼叫，也可手動執行 |

`start.bat` 與 `release.bat` 找不到 `node_modules\` 時會自己執行 `npm install`。

### 專案結構

```
stock-portfolio/
├── bin/         # Neutralino 框架執行檔（neu run 需要，由 prepare.bat 自動下載，不納入版控）
├── build/       # Vite 產出（不納入版控）
├── dist/        # 打包產出（不納入版控）
├── config/      # 舊版資料，僅供首次啟動遷移（ADR-0029）
├── logs/        # app.log（首次執行產生，不納入版控）
├── docs/        # 規格、架構、詞彙、ADR
├── resources/   # 圖示、favicon、字型（Vite 的 publicDir）
├── scripts/     # start / release / kill
└── src/
    ├── domain/    # 模型與計算，零依賴
    ├── services/  # 報價、儲存、對照表、日誌
    └── ui/        # 表格、編輯控制、狀態列、主題
```

`build/` 是 Vite 的產出，`dist/` 是 `neu build` 的產出，兩者不可共用。完整說明見 `docs/architecture.md`。

## 文件導覽

ADR（Architecture Decision Record）記錄每個技術選擇當時的取捨。

| 文件 | 內容 |
|---|---|
| `docs/requirements.md` | 功能規格：每個功能的規則、驗證、邊界 |
| `docs/architecture.md` | 分層、模組職責、資料流、檔案格式 |
| `docs/glossary.md` | 領域詞彙的單一定義來源 |
| `docs/adr/` | 技術決策紀錄 |
