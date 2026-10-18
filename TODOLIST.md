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

### P4b 編輯畫面（已完成，待實機驗收）

- [x] `src/ui/EditControls.ts` — 模式切換鈕、新增表單、強制新增逃生門、表單驗證與錯誤訊息
- [x] `src/ui/TableView.ts` — 就地編輯（點格子變輸入框）、操作欄（刪除 / 儲存 / 取消）、輪詢重繪時還原焦點與游標
- [x] `src/main.ts` — 草稿狀態、`commitEdit`、`addHolding`（含補抓一次）、`removeHolding`（原生二次確認）
- [x] `QuoteService.refreshOnce()` — 單次抓取不啟動輪詢，並加上同時只允許一次請求的保護
- [x] 空狀態引導：檢視模式提示切換、編輯模式顯示「新增股票」鈕
- [x] `docs/adr/ADR-0012.md` — 編輯介面形態，並同步 `requirements.md`（F1 / F2 / F3 / F4 / F8）、`glossary.md`、`architecture.md` §3.3 與 §5.3
- [x] `src/ui/EditControls.test.ts` — 代號解析、新增驗證、千分位解析
- [x] 15 個測試檔案、105 個測試通過，`tsc --noEmit` 與 `vite build` 通過

#### P4b 驗收（實機，2026-10-17）

- [x] 檢視模式：無「操作」欄、無輸入框、無新增鈕，表格與 P4a 相同（9 欄）
- [x] 切「編輯」：出現操作欄與新增鈕；切回「完成」時進行中的草稿被放棄（草稿 0 被丟棄、股數回到 1,500）
- [x] 就地編輯：點股數格變輸入框，改值後 Enter 儲存 → `portfolio.json` 更新（1000 → 1500）；Esc 取消 → 值還原
- [x] 驗證失敗（股數 0、平均成本 0）→ 該列顯示「股數必須為正整數」／「平均成本必須為正數」、輸入內容保留、檔案未變動
- [x] 欄頭重繪不打斷輸入：點「代號」欄頭觸發 tbody 重建後，草稿、輸入內容與 `:focus` 都保留
      > 5 秒輪詢那條路徑需盤中才能走（同一段重繪程式碼）
- [x] 刪除：原生對話框顯示「刪除 2330 台積電？」與「此動作不可復原。」，按「否」不刪除、按「是」刪除並寫回檔案（移出輪詢於盤外無法觀察）
- [x] 新增：輸入 2330 自動帶出「台積電 · 上市」；輸入已存在代號 → 「代號已存在，請改用編輯」
- [x] 強制新增：輸入 9999 → 「查無此代號」與預設收起的逃生門；展開後自填市場與名稱可新增成功
- [x] 新增成功後新列立即有報價：2330 加入後該列立刻出現 `▼2,420.00` 與四個報酬欄，總計列同步（非交易時段亦同，經 `refreshOnce`）
- [x] `portfolio.json` 損毀時：`編輯` 鈕停用，狀態列顯示「無法讀取 portfolio.json，已停用設定寫入」＋解析錯誤
- [x] 空持股：編輯模式下顯示「新增股票」鈕可直接展開表單

#### P4b 驗收發現的缺陷（與附帶確認）

- [x] **刪除的二次確認對話框從來沒出現過。** `@neutralinojs/lib` 的 `MessageBoxChoice` / `Icon` 只有 `.d.ts` 的 `declare enum`，`dist/*.js` 完全沒有對應值，執行期是 `undefined` → `MessageBoxChoice.YES_NO` 丟 `TypeError`，又被 `void removeHolding(code)` 吞掉，沒有任何痕跡。改為傳字面值（`'YES_NO' as MessageBoxChoice`）並把型別改成 `import type`。單元測試碰不到原生呼叫，只有實機能抓到
- [ ] 就地編輯的輸入框沒有自動聚焦：點格子產生輸入框後 `:focus` 不在輸入框，要再點一次才能打字（`TableView.ts` 的 `editableCell` 未呼叫 `focus()`）。驗收時因此一度誤判成「環境問題」而非程式缺陷
- [ ] `portfolio.json` 帶 UTF-8 BOM 時讀取失敗（`ERROR portfolio.corrupt Unexpected token ''`），會退回預設 1100×760 並停用編輯。app 自己寫的檔案沒有 BOM，但用記事本／部分編輯器存檔會加上去。要不要容錯屬新的技術決策
- [x] 附帶確認：MIS 回應缺少 9999 時只記 `WARN quote.missing MIS 未回傳報價：9999`，狀態列仍為 `MIS 即時`，log 無任何降級事件

### P4a 驗收（實測 2026-10-16）

- [x] 5 檔持股（含 MIS 查無資料的假代號 9999）於 1100×760：9 欄齊備、現價帶 `▲` / `▼`、無成交列淡化、總計列與「已排除 1 檔：缺估值價」註記正確
- [x] 點欄頭：`現價` 首次點擊為遞減（`現價 ▾`），`代號` 首次為遞增（`代號 ▴`）；9999 缺值在遞減下仍排最後
- [x] 偏好持久化：點欄頭後寫入 `sortKey` / `sortDirection`；視窗改到 700×480 後寫入 `windowWidth: 684`、`windowHeight: 441`
- [x] 重啟還原：`setSize` 回套內容尺寸 684×441（外框 700×480），來回不遞減 → **此結論錯誤**：`setSize` 收的是外框尺寸（實體 px），當時只在最小尺寸驗證，最小尺寸的夾制把縮小蓋掉了。見 ADR-0013
- [x] 空持股：空狀態、總計列全 `NT$0`、`總報酬率 —`、狀態列只顯示「已收盤」且不發請求
- [x] 最小視窗 700×480：9 欄仍在單一畫面內，無水平捲動 → **此結論已被 ADR-0011 取代**（見下方「P4a 後續修正」）
- [x] 對比（相對 `--bg`）：`--text` 15.6:1、`--text-dim` 7.2:1、`--text-faint` 4.6:1、`--up` 5.5:1、`--down` 8.0:1，皆 ≥ 4.5:1
- [x] 12 個測試檔案、89 個測試通過，`tsc --noEmit` 通過

### P4a 後續修正（2026-10-16，commit「fix scale」與其補完）

- [x] 縮放加上下限：`MIN_SCALE = 0.85`（對應視窗寬 935），低於下限改由表格水平捲動消化 → `docs/adr/ADR-0011.md` → 下限仍為 0.85，但「低於下限由表格水平捲動消化」與 700×480 的固定下界已被 ADR-0016 取代
- [x] 補上 `docs/adr/ADR-0011.md`（前一版只在 `scale.ts` 註解引用，文件未落地）
- [x] 同步 `requirements.md` F11、`glossary.md`、`architecture.md` 的 ADR 索引、`README.md` 的 ADR 篇數
- [x] 修正 `TableView.test.ts` 的 `defaultDirection('marketValue')` 失敗：數字欄的判定改由單一 `NUMERIC_KEYS` 集合提供，`marketValue` 不再因未顯示而落到文字欄
- [x] 測試範圍納入 `src/ui` 純函式，同步 `README.md` 與 `AGENTS.md`

### P4a 發現的坑

- **`ui-ux-pro-max` 的配色資料庫沒有一個能用的金融深色樣本。** 唯一的 `Financial Dashboard` 是 Tailwind slate + `#22C55E`，正是 `frontend-design` 點名的「近黑底 + 單一亮綠」樣板，而且「綠＝漲」與台股慣例相反。依 skill 規則改為自定色票，推導寫在 `theme.css` 檔頭
- **紅漲綠跌反過來約束了整個介面的狀態色**：警示不能用紅或橙紅（會被讀成「漲」），改用琥珀 `--warn`；互動焦點改用鋼藍 `--accent`。紅綠在介面上只代表漲跌
- `window.setSize` 的 `width` / `height` 是**內容尺寸**，不含標題列與外框。存 `window.innerWidth`、還原用 `setSize`，兩者同一基準才不會逐次縮小 → **此結論錯誤**：`setSize` 收的是外框尺寸（實體 px）。已於「啟動抓價與視窗尺寸修正」改為換算後再呼叫，見 ADR-0013
- F11 的等比縮放原本沒有下限：視窗收到最小 700 寬時，13px 的表格字級會縮到約 8.3px。已於「P4a 後續修正」加上下限 0.85（ADR-0011）
- `PnlTotals` 只有 `todayReturn`，沒有今日報酬率欄位；總計列因此只顯示 F12 列的「今日總報酬」金額 → 已於「報酬欄顯示模式切換」補上 `todayReturnRate`（ADR-0015）
- `src/ui/*.test.ts` 於 P4a 後續修正補上（`scale.test.ts`、`TableView.test.ts`、`EditControls.test.ts`），`README.md` 與 `AGENTS.md` 的測試範圍已同步納入 `src/ui` 的純函式
- `resources/icons/appIcon.png` 的 P1 幾何 placeholder（紅漲綠跌三柱）已於 P5 前換成正式圖示，見 P5 段

### 啟動抓價與視窗尺寸修正（2026-10-16，驗收 P4b 時發現）

- [x] 診斷「啟動沒抓現價」：用相同 `portfolio.json` 手動啟動兩次都正常（`targets=1 quotes=1`、現價 `▼2,420.00`、狀態列「更新於」、總市值與總報酬率都有值），MIS 連打 6 次也都回 `z=2420`。log 無 `quote.fail`，無法重現，只能確定有兩條「靜默失敗」路徑
- [x] 量測 `net.get` 的 `timeout`：指定 3 秒，實際 21,066 ms 才失敗（OS 的 TCP 逾時）→ `http.ts` 補上 JS 端計時器，逾時會記入 `quote.fail` 並計入降級次數
- [x] MIS 回應缺少請求中的代號時記 `WARN quote.missing`（不計入失敗、不降級）→ 同步 `requirements.md` F16
- [x] 非交易時段首抓沒取得報價時延遲 5 秒重試一次（`STARTUP_RETRY_MS`）→ `docs/adr/ADR-0014.md`，同步 `requirements.md` F5 / F16、`architecture.md` §5.1 與 §8
- [x] 抽出 `domain/quote.ts` 的 `codesWithoutQuote()` 供 `MisProvider`（記 WARN）與 `QuoteService`（判斷是否重試）共用，並補單元測試
- [x] 量測 `window.setSize`：`width` / `height` 與 `minWidth` / `minHeight` 是外框尺寸（實體 px）→ `applyWindowSize` 換算後再呼叫
- [x] 修正後實測：內容 724×480 連續兩次啟動都還原成 724×480（修正前是 724 → 566 → 546 卡在最小）
- [x] 修掉 `resize` 監聽的競態：框架建立視窗的初始尺寸會先觸發 `resize`，那時寫回 `portfolio` 會讓 `applyWindowSize` 反過來套用初始尺寸（實測 724×480 被 866×571 蓋掉）。改成首次套用完成後才開始記錄
- [x] `docs/adr/ADR-0013.md`，同步 `architecture.md`（§6.1、§7.1、§7.4、ADR 索引）、`requirements.md` F11 / F14 / F16、`README.md` ADR 篇數
- [x] `tsc --noEmit` 與 109 個測試通過
- [ ] 追蹤：若再出現「啟動沒抓到現價」，先看 `logs/app.log` 是 `quote.fail`（逾時或連線失敗）、`quote.missing`（查無資料）還是 `quote.retry`（已重試一次仍失敗）

## P5 打包與驗收

- [x] `neu build` 產 Windows 執行檔
- [ ] 端到端驗收：盤中即時更新、盤外停止、降級與回試、重啟後偏好還原、縮放、深色
      > 盤外已驗：打包後的 exe 可啟動、輪詢啟動後停止、`symbols.json` 當日快取命中不重抓。盤中即時更新與降級回試需交易時段
- [x] 首次執行 `npx neu build --release`，核對 `dist/` 實際產物與 README 記載一致
      > `dist/stock-portfolio/`：`stock-portfolio-win_x64.exe`（2,459,136 bytes）+ `resources.neu`（53,428 bytes）；`dist/stock-portfolio-release.zip`（1,180,903 bytes）。與 README 記載相符
- [x] 換上正式 `resources/icons/appIcon.png`：深色圓角磚 ＋ 鋼藍 `$`，512×512。配色全部取自 `theme.css`（`--surface-raised` 底磚、`--line-strong` 邊框、`--accent` 字）。`neutralino.config.json` 的圖示路徑不變

### P5 發現的坑

- **打包後的 exe 以「行程工作目錄」解析相對路徑，不是 exe 所在目錄。** `config/` 與 `logs/` 都走相對路徑，因此從別的目錄啟動 exe（例：`Start-Process` 未指定 `-WorkingDirectory`）時，資料會落在該目錄而非 `dist/stock-portfolio/`。雙擊執行時兩者相同，故不影響一般使用。若要固定，需以 `os.getPath` 取得 exe 目錄再組絕對路徑，屬新的技術決策
- `NE_RS_UNBLDRE: Unable to load application resource file /build/favicon.ico`：webview 會自動請求 `/favicon.ico`，`resources/` 內沒有此檔。只出現在框架的 `neutralinojs.log`，不影響運作
- `dist/stock-portfolio/neutralinojs.log` 是框架自己寫的，與 `logs/app.log` 無關，兩者不要混淆

## 報酬欄顯示模式切換（2026-10-18）

- [x] 兩個報酬欄改為「比率 / 金額」二選一（F1：檢視模式由 9 欄降為 7 欄），欄頭文字與總計列跟著模式變 → `docs/adr/ADR-0015.md`
- [x] 新增投組今日報酬率 = 今日總報酬 ÷ 昨日總市值（Σ 昨收 × 股數），只算昨收不缺的持股，分母 0 顯示 `—`；`PnlTotals` 加 `todayReturnRate`（分母以 `marketValue − todayReturn` 求得） → 同步 F12、`glossary.md`
- [x] `portfolio.json` 加 `returnDisplay`（預設 `rate`），`schemaVersion` 維持 1（缺欄位或非法值回預設）
- [x] 切換時排序鍵在 `totalReturn` ↔ `totalReturnRate`、`todayReturn` ↔ `todayReturnRate` 之間對映，方向不變 → 同步 F13、`TableView.mapSortKey`
- [x] 工具列加顯示切換鈕（顯示當前單位 `%` / `NT$`）；`portfolio.json` 損毀時仍可切換，只是不寫回（沿用 `scheduleSave` 的既有保護）
- [x] 測試：`pnl`（重量加權、缺昨收排除分母、空投組）、`storage`（`returnDisplay` 缺失／非法／合法）、`TableView`（`columnsFor`、`mapSortKey`）
- [x] `tsc --noEmit` 與 114 個測試通過（原 109）
- [x] 實機驗收（2026-10-18 盤外）：舊檔缺 `returnDisplay` 時開在 `%`；切換後欄頭變「總報酬金額／今日報酬金額」、逐列金額無 `NT$`、總計列變 `NT$20,000` / `NT$-20,000`；點「總報酬金額」欄頭排序再切回 `%`，`sortKey` 由 `totalReturn` 變 `totalReturnRate`、方向維持 `desc`；重啟後還原成金額模式且排序指示留在「總報酬金額」

## 欄寬貼齊與動態最小視窗尺寸（2026-10-18）

- [x] `table { width: max-content }`：欄寬由內容決定，不再隨視窗平均拉開（`theme.css`）
- [x] 最小視窗尺寸改由內容推得：在縮放下限量測內容自然寬度（工具列／表格／總計列／狀態列取最大）＋垂直捲軸保留區；最小高度 = 最小寬度 × 760/1100 → `docs/adr/ADR-0016.md`
- [x] `.board { scrollbar-gutter: stable }`：垂直捲軸出現與否不改變客戶區寬度，最小寬度不會少算一個捲軸寬
- [x] 移除 `main.ts` 的 `MIN_WIDTH = 700` / `MIN_HEIGHT = 480`；`refresh()` 後重算，值有變才重新套用 `setSize`
- [x] 新增表單不列入量測（表單可換行、不會水平溢出）；量測時把寬度設 0，用 `hidden` 會讓輸入框在輪詢重繪時失焦
- [x] `scale.ts` 加 `BASE_HEIGHT` 與 `minHeightFor()`，測試涵蓋比例換算；`tsc --noEmit` 與 115 個測試通過
- [x] 實機驗收：欄位貼齊；設定 300×200 啟動時抬到 500×345（報價載入前為 483×334）；該尺寸下 7 欄全可見、無水平捲軸；切到編輯模式（多「操作」欄）下限變 564×390 且不裁切；展開新增表單不影響下限

## 未排入 v1

CSV 匯入/匯出、i18n 多語、亮色主題與切換鈕、交易明細與已實現損益、股利與費稅、官方 EOD 校正層、券商 API、自動更新。
