# 專案操作規則

本檔為本專案的硬性約束。與全域 `AGENTS.md` 衝突時，以全域檔為主。

## 專案定位

單機、單人使用的台股庫存檢視桌面應用程式（Neutralinojs + TypeScript/Vite，Windows）。以唯讀檢視為主，編輯為輔，不涉及下單。

## 目錄用途

| 目錄 | 用途 |
|---|---|
| `docs/` | 規格文件。`requirements.md` 是需求單一定義來源，`glossary.md` 是領域詞彙單一定義來源 |
| `docs/adr/` | 技術決策紀錄。僅新增，不修改已發布的 ADR |
| `src/domain/` | 模型與計算。**零依賴**，不得 import `services/` 或 `ui/`，不得出現任何報價來源的欄位名 |
| `src/services/` | 報價、儲存、對照表、日誌。可 import `domain/`，不得 import `ui/` |
| `src/ui/` | 表格、編輯控制、狀態列、主題。可 import 下層，不得被下層 import |
| `logs/` | 只寫 `app.log`，由 `src/services/logger.ts` 寫入。框架的 `neutralinojs.log` 已關閉（ADR-0023） |
| `resources/` | `appIcon.png`、`favicon.ico`（`documentRoot` 是 `/build/`，webview 會要 `/build/favicon.ico`）與字型檔。不放圖片素材 |
| `scripts/` | 雙擊用的便利腳本：`start.bat`（啟動，`inspector` 參數附開發者工具）、`release.bat`（打包）、`kill.bat`（清除殘留的專案程序；`start.bat` 啟動前後呼叫）、`prepare.bat`（前置檢查：缺框架執行檔時依 `binaryVersion` 下載，缺 `node_modules\` 時執行 `npm install`；由 `start.bat` 與 `release.bat` 呼叫）。一律 `cd /d "%~dp0.."` 切到專案根目錄再執行 |

`neutralino.config.json` 必須在專案根目錄，Neutralino 不接受其他位置。

## 同步規則

需求透過 Agent 調整時，下列文件必須同步，缺一即視為未完成：

| 變更類型 | 必須同步 |
|---|---|
| 新增 / 修改功能 | `docs/requirements.md`、`docs/glossary.md`（若涉及新詞彙） |
| 修改技術決策 | `docs/adr/` **新增**一篇 ADR（已發布的 ADR 不改），並同步 `docs/architecture.md` 的 ADR 索引 |
| 修改模組邊界或資料流 | `docs/architecture.md` |
| 修改目錄用途或建置指令 | `README.md`、本檔 |
| 刪除或改名檔案 | 同步清除所有引用該檔的文件 |

## 硬性約束

1. **UI 不得直接呼叫報價 API。** 一律經 `QuoteService` 與 `QuoteProvider` 介面。
2. **報價來源的欄位名不得洩漏到 `domain/`。** `domain/` 只認 `Quote` 型別（`code` / `price` / `valuationPrice` / `previousClose` / `traded` / `dataDate`）。
3. **報酬率公式不得逕行修改。** 公式定義於 `docs/requirements.md`，變更必須先新增 ADR。
4. **顏色只能取自 CSS 變數。** 不得在元件內寫死色碼。漲跌方向遵循台股慣例**紅漲綠跌**。
5. **不引入 UI 框架。** 新增任何 npm 依賴（含 devDependency）都需要一篇 ADR。
6. **不新增防護碼、註解、抽象層**，除非是正確性所必需（例如外部 API 回應為不可信的輸入）。
7. 交易時段固定為台北時間 **09:00–13:30**，以系統本地時間判斷，假設執行環境為 `+08:00`。

## 建置與執行

```bash
npm install
npm run dev                                    # Vite 開發伺服器
npx neu run                                    # 桌面應用程式（會帶起 Vite）
npx neu run -- --window-enable-inspector        # 同上，附開發者工具
npm test                                       # vitest（純函式；services 以 mock 隔離 Neutralino API）
npx neu build --release                        # 打包 Windows 執行檔到 dist/
```

- Node.js 22.12 以上（`vitest` 的下限）
- `scripts\start.bat` 與 `scripts\release.bat` 找不到 `node_modules\` 時會自己執行 `npm install`，不必先手動跑
- 打包後的 exe 以行程的工作目錄解析 `logs/` 這類相對路徑，不是以 exe 所在目錄為準
- 不會產生 `neutralinojs.log`（`logging.writeToLogFile: false`）；排查只看 `logs/app.log`
- `scripts\kill.bat` 只結束兩類行程：執行檔位於本專案目錄下（`bin\`、`dist\`、`node_modules\`），或 `node.exe` 的命令列指向本專案的 `node_modules` 工具鏈（vite / vitest / esbuild / @neutralinojs）
- `start.bat` 啟動的 `neu run` 與 Vite 必須在 `start.bat` 內嵌的 PowerShell 程序結束時一併結束（Job Object，`KILL_ON_JOB_CLOSE`），關窗、關主控台、Ctrl+C 都不需手動清理
- `scripts\*.bat` 必須只含 ASCII，包含 `echo`、`rem`、內嵌 PowerShell 的字串。中文即使存成 UTF-8 並加 `chcp 65001` 仍會在 `call` 返回後被 cmd 當成指令執行（出現 `'xxx' 不是內部或外部命令`）。訊息與註解一律用英文；不要改用 CP950 或 UTF-8 中文版。修改後以位元組檢查（非 ASCII 位元組數須為 0）確認
- `build/` 是 Vite 的產出，`dist/` 是 `neu build` 的產出，兩者不可共用（見 `docs/architecture.md` §7.2）
- `bin/neutralino-win_x64.exe` 是框架執行檔，`neu run` 需要它，不納入版控；`scripts\start.bat` 與 `scripts\release.bat` 會先呼叫 `scripts\prepare.bat`，缺檔時依 `neutralino.config.json` 的 `cli.binaryVersion` 下載到 `bin\`（見 ADR-0022、ADR-0025）。版本必須等於 `cli.binaryVersion`
- dev 模式下 `window` 的 `resize` 事件用 DOM 監聽即可，**不要**找 `windowResize` 事件，它不存在

## 文件語言

繁體中文。程式碼、命令、路徑、API 名稱、錯誤訊息、領域專有名詞保留原文，不翻譯、不意譯。
