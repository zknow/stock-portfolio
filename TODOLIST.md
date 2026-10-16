# TODOLIST

實作順序。完成一項就把 `[ ]` 改成 `[x]`。P0 已完成，P1 之後待呼叫接續。

規格依據：`docs/requirements.md`。決策依據：`docs/adr/`。

---

## P0 文件

- [x] `TODOLIST.md`
- [x] `README.md`
- [x] `AGENTS.md`
- [x] `docs/requirements.md`
- [x] `docs/architecture.md`
- [x] `docs/glossary.md`
- [x] `docs/adr/ADR-0001` — 報價來源與降級策略
- [x] `docs/adr/ADR-0002` — 庫存模型只存平均單位成本
- [x] `docs/adr/ADR-0003` — 報酬率公式
- [x] `docs/adr/ADR-0004` — 儲存於 `config/` 下的單一 JSON
- [x] `docs/adr/ADR-0005` — TypeScript + Vite，不引入框架
- [x] `docs/adr/ADR-0006` — 縮放改用內容等比
- [x] `docs/adr/ADR-0007` — 固定深色主題
- [x] `docs/adr/ADR-0008` — 視窗尺寸與輪詢時段

## P1 專案骨架

- [x] `git init` + `.gitignore`（排除 `node_modules/`、`bin/`、`build/`、`dist/`、`.tmp/`、`logs/`、`config/portfolio.json`、`config/symbols.json`）
- [x] 取 `neutralinojs/neutralinojs-zero` 骨架 + 手動接 Vite + TypeScript
      > `neu create` 走不通（CLI 的 HTTP 客戶端不支援 proxy），改為手動下載模板 zip
- [x] `neutralino.config.json`：`applicationId`、`modes.window`、`dataLocation: "app"`、`nativeAllowList`
- [x] `filesystemScopes` 留空（v6.10.0 新限制，設了會擋檔案存取）
- [x] `resources/icons/appIcon.png`（暫時的幾何 placeholder，紅漲綠跌三柱）
- [x] 手動放置 `bin/neutralino-win_x64.exe`（CLI 同樣無法下載框架執行檔）

### P1 驗收（實測 2026-10-16）

- [x] 開窗：`npx neu run` → `neu CLI connected with the application.`
- [x] Vite + HMR：dev server 起在 5173，改 `src/main.ts` 會觸發 page reload，**reload 後 globals 仍正常注入**
- [x] `modes.window.injectGlobals: true` 生效 → `NL_GINJECTED: true`、`NL_VERSION: 6.10.0`、`NL_RESMODE: directory`
- [x] `filesystem` 可用 → 成功寫出檔案
- [x] `os.getPath` 可用
- [x] **`Neutralino.net.get` 可用** → 對 `http://127.0.0.1:5173` 回 200
- [x] TypeScript 7.0.2 的 `tsc --noEmit` 與 Vite 8.3.4 build 皆通過

### P1 發現的坑（已寫入 docs）

- `filesystem.createDirectory` 在目錄已存在時回報 `NE_FS_DIRCRER`，必須視為成功
- **`Neutralino.net` 不支援 proxy**，在需要 proxy 連外的網路上 MIS 會逾時。已決定加第二條傳輸，見 ADR-0009
- `neu build` 的輸出目錄固定為 `dist/`，故 Vite 的 `outDir` 改用 `build/`

## P2 domain（零依賴）

- [x] `src/domain/types.ts` — `Holding`、`Quote`、`SymbolEntry`、`Market`、`QuoteSource`、`QuoteBatch`
- [x] `src/domain/quote.ts` — `parsePrice`、`buildQuote`（估值價與是否有成交）、`isStale`
- [x] `src/domain/pnl.ts` — `computePnlRow`、`computeTotals`（含排除檔數）
- [x] `src/domain/format.ts` — 千分位、價格 2 位、金額 0 位、報酬率 2 位加 `%`、`MISSING`、`directionOf`
- [x] `src/domain/validate.ts` — `isValidCode`、`isValidShares`、`isValidCost`
- [x] vitest：4 個檔案、31 個測試，`tsc --noEmit` 通過

**與原規劃的差異**：MIS 回應解析、現價解析三種分支與 `c === ""` 判定改放 `services/quote/MisProvider.ts`，因為 `domain/` 不得出現報價來源欄位名（硬性約束 2）。`domain/quote.ts` 只做來源無關的價數字串解析與 `Quote` 建構。

## P3 services

- [x] 報價傳輸決策與 `docs/adr/ADR-0009.md`：`net.get` 為主，偵測到 `HTTPS_PROXY` / `HTTP_PROXY` 時改用 `curl.exe`
- [x] `src/services/http.ts` — 唯一的傳輸出口。`getText(url)` 依環境變數選 `net.get` 或 `curl.exe -s -i -m`，統一回傳 `{ status, body }`
- [x] `src/services/storage.ts` — 讀寫 `config/portfolio.json`（`createDirectory` 的 `NE_FS_DIRCRER` 要視為成功，JSON 帶 `schemaVersion`）
- [x] `src/services/symbolTable.ts` — 合併 `STOCK_DAY_ALL` + `tpex_mainboard_quotes`，寫入 `config/symbols.json`，每日更新一次
- [x] `src/services/quote/MisProvider.ts` — 批次 `ex_ch` 請求，5 秒輪詢。含現價解析順序（`trade.z` → `z` → 無成交）與 `c === ""` 判定，兩者需有單元測試
- [x] `src/services/quote/YahooProvider.ts` — `.TW` / `.TWO` 對照，20 分延遲
- [x] `src/services/quote/QuoteService.ts` — 交易時段判斷、失敗計數、降級、回試、狀態廣播
- [x] `src/services/logger.ts` — 寫 `logs/app.log`，只記異常與狀態轉換
- [x] vitest 測試覆蓋：降級門檻、回試間隔、對照表合併、`schemaVersion` 遷移

順帶拆出的小模組：`clock.ts`（時間文字與交易時段）、`fsutil.ts`（`ensureDirectory`）、`quote/QuoteProvider.ts`（介面）。`domain/types.ts` 補上 `QuoteTarget`、`SortKey`、`SortDirection`、`UiPreferences`。

### P3 驗收（實測 2026-10-16）

- [x] `os.getEnvs` 讀得到 `HTTPS_PROXY` → 傳輸確實走 curl 路徑
- [x] 對照表：`ensureFresh` 抓到 1379 + 1012 = 2391 筆，寫入 `config/symbols.json`，`lookup('2330')` 命中且中文 UTF-8 正確
- [x] MIS 批次查詢 2330（上市）、6488（上櫃）、9999（不存在）→ 回兩筆報價，`9999` 因 `c === ""` 被略過
- [x] 2330 回現價 2420、昨收 2440、`dataDate` 20261016；6488 回現價 902、昨收 923
- [x] `logs/app.log` 寫入成功，中文編碼正確
- [x] `portfolio.json` 不存在時回預設值，`error` 為 null，未誤建檔案
- [x] 12 個檔案、84 個測試通過，`tsc --noEmit` 通過
- [ ] Yahoo 實機查詢回 HTTP 429（探勘階段請求過多被限流），留待 P5
- [ ] `net.get` 路徑實機查詢：本機有 proxy 走不到，留待 P5

### P3 發現的坑（已寫入 docs）

- **`curl.exe -i` 走 proxy 時會輸出兩個標頭區塊。** `HTTP/1.1 200 Connection established` 之後才是真正的回應。只剝第一個區塊會把真正的狀態列留在 body 裡，`JSON.parse` 因此失敗。修正為連續剝除開頭區塊，取最後一塊的狀態碼

## P4 UI

### P4a 唯讀畫面（已完成）

- [x] 載入 `frontend-design` 與 `ui-ux-pro-max` skills 決定深色 palette
- [x] `src/ui/theme.css` — 深色 design token（CSS 變數），紅漲綠跌色票
- [x] `src/ui/scale.ts` — DOM `resize` 監聽，依寬度對基準寬 1100 等比縮放
- [x] `src/ui/TableView.ts` — 9 欄表格、欄頭排序、總計列、無成交列淡化
- [x] `src/ui/StatusBar.ts` — 更新時間、來源標籤、降級警示色、非當日資料標記
- [x] `src/main.ts` — 組裝啟動流程（§5.1）、偏好持久化、`windowClose` 收尾與關閉記錄
- [x] `src/services/clock.ts` 補 `isAfterClose`，區分狀態列的「已收盤」與「非交易時段」

### P4b 編輯畫面（待做）

- [ ] `src/ui/EditControls.ts` — 新增/編輯/刪除（二次確認）、強制新增逃生門
- [ ] F8 檢視 / 編輯模式切換；空狀態補上「新增股票」引導
- [ ] 編輯模式下輸入框不被 5 秒輪詢的重繪打斷

### P4a 驗收（實測 2026-10-16）

- [x] 5 檔持股（含 MIS 查無資料的假代號 9999）於 1100×760：9 欄齊備、現價帶 `▲` / `▼`、無成交列淡化、總計列與「已排除 1 檔：缺估值價」註記正確
- [x] 點欄頭：`現價` 首次點擊為遞減（`現價 ▾`），`代號` 首次為遞增（`代號 ▴`）；9999 缺值在遞減下仍排最後
- [x] 偏好持久化：點欄頭後寫入 `sortKey` / `sortDirection`；視窗改到 700×480 後寫入 `windowWidth: 684`、`windowHeight: 441`
- [x] 重啟還原：`setSize` 回套內容尺寸 684×441（外框 700×480），來回不遞減
- [x] 空持股：空狀態、總計列全 `NT$0`、`總報酬率 —`、狀態列只顯示「已收盤」且不發請求
- [x] 最小視窗 700×480：9 欄仍在單一畫面內，無水平捲動
- [x] 對比（相對 `--bg`）：`--text` 15.6:1、`--text-dim` 7.2:1、`--text-faint` 4.6:1、`--up` 5.5:1、`--down` 8.0:1，皆 ≥ 4.5:1
- [x] 12 個測試檔案、89 個測試通過，`tsc --noEmit` 通過

### P4a 發現的坑

- **`ui-ux-pro-max` 的配色資料庫沒有一個能用的金融深色樣本。** 唯一的 `Financial Dashboard` 是 Tailwind slate + `#22C55E`，正是 `frontend-design` 點名的「近黑底 + 單一亮綠」樣板，而且「綠＝漲」與台股慣例相反。依 skill 規則改為自定色票，推導寫在 `theme.css` 檔頭
- **紅漲綠跌反過來約束了整個介面的狀態色**：警示不能用紅或橙紅（會被讀成「漲」），改用琥珀 `--warn`；互動焦點改用鋼藍 `--accent`。紅綠在介面上只代表漲跌
- `window.setSize` 的 `width` / `height` 是**內容尺寸**，不含標題列與外框。存 `window.innerWidth`、還原用 `setSize`，兩者同一基準才不會逐次縮小
- F11 的等比縮放沒有下限：視窗收到最小 700 寬時，13px 的表格字級會縮到約 8.3px。規格如此，未擅自加上限縮
- `PnlTotals` 只有 `todayReturn`，沒有今日報酬率欄位；總計列因此只顯示 F12 列的「今日總報酬」金額
- `src/ui/*.test.ts` 不存在：`README.md` 與 `AGENTS.md` 訂的測試範圍是 `src/domain` 與 `src/services`，`sortRows` 的缺值排序改以實機點擊驗證
- `resources/icons/appIcon.png` 仍是 P1 的幾何 placeholder（紅漲綠跌三柱）。正式圖示待 P5 前決定

## P5 打包與驗收

- [ ] `neu build` 產 Windows 執行檔
- [ ] 端到端驗收：盤中即時更新、盤外停止、降級與回試、重啟後偏好還原、縮放、深色
- [ ] 首次執行 `npx neu build --release`，核對 `dist/` 實際產物與 README 記載一致

## 未排入 v1

CSV 匯入/匯出、i18n 多語、亮色主題與切換鈕、交易明細與已實現損益、股利與費稅、官方 EOD 校正層、券商 API、自動更新。
