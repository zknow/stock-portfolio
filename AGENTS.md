# 專案操作規則

本檔為本專案的硬性約束。與全域 `AGENTS.md` 衝突時，以全域檔為主。

## 專案定位

單機、單人使用的台股庫存檢視桌面應用程式（Neutralinojs + TypeScript/Vite，Windows）。唯讀檢視為主，編輯為輔，不涉及下單。

## 目錄用途

| 目錄 | 用途 |
|---|---|
| `docs/` | 規格文件。`requirements.md` 是需求單一定義來源，`glossary.md` 是領域詞彙單一定義來源 |
| `docs/adr/` | 技術決策紀錄。僅新增，不修改已發布的 ADR |
| `src/domain/` | 模型與計算。**零依賴**，不得 import `services/` 或 `ui/`，不得出現任何報價來源的欄位名 |
| `src/services/` | 報價、儲存、對照表、日誌。可 import `domain/`，不得 import `ui/` |
| `src/ui/` | 表格、編輯控制、狀態列、主題。可 import 下層，不得被下層 import |
| `config/` | 執行期設定。`portfolio.json`（庫存與 UI 偏好）、`symbols.json`（對照表快取）。**不得在此放 Neutralino 設定** |
| `logs/` | 只寫 `app.log` |
| `resources/` | `icons/` 與字型檔。不放圖片素材 |

`neutralino.config.json` 必須在專案根目錄，Neutralino 不接受其他位置。

## 同步規則

需求透過 Agent 調整時，下列文件必須同步，缺一即視為未完成：

| 變更類型 | 必須同步 |
|---|---|
| 新增 / 修改功能 | `docs/requirements.md`、`docs/glossary.md`（若涉及新詞彙） |
| 修改技術決策 | `docs/adr/` **新增**一篇 ADR，並同步 `docs/architecture.md` |
| 修改模組邊界或資料流 | `docs/architecture.md` |
| 修改目錄用途或建置指令 | `README.md`、本檔 |
| 任何上述變更 | `TODOLIST.md`（若影響待辦） |

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
npm test                                       # vitest（src/domain、src/services、src/ui 的純函式）
npx neu build --release                        # 打包 Windows 執行檔到 dist/
```

- `build/` 是 Vite 的產出，`dist/` 是 `neu build` 的產出，兩者不可共用（見 `docs/architecture.md` §7.2）
- `bin/neutralino-win_x64.exe` 是框架執行檔，`neu run` 需要它。neu CLI 在公司 proxy 環境下無法下載，若 `bin/` 為空需手動放置
- dev 模式下 `window` 的 `resize` 事件用 DOM 監聽即可，**不要**找 `windowResize` 事件，它不存在

## 文件語言

繁體中文。程式碼、命令、路徑、API 名稱、錯誤訊息、領域專有名詞保留原文，不翻譯、不意譯。
