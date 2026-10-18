@echo off
setlocal

rem 本機是 UTF-8 系統（ACP 65001），本檔以 UTF-8 無 BOM 儲存，不要加 chcp
rem 雙擊時的工作目錄不一定是專案根目錄，一律切到這支腳本所在位置
cd /d "%~dp0"

if not exist "node_modules\" (
  echo [錯誤] 找不到 node_modules，請先執行：npm install
  pause
  exit /b 1
)

if not exist "bin\neutralino-win_x64.exe" (
  echo [錯誤] 找不到 bin\neutralino-win_x64.exe
  echo        neu CLI 無法在公司 proxy 環境下載這個檔案，需手動取得
  echo        版本與步驟見 README.md 的「執行」段落
  pause
  exit /b 1
)

if /i "%~1"=="inspector" (
  echo 啟動桌面應用程式（附開發者工具）...
  echo.
  npx neu run -- --window-enable-inspector
) else (
  echo 啟動桌面應用程式...
  echo 提示：加參數 inspector 可開啟開發者工具，例如 start.bat inspector
  echo.
  npx neu run
)

echo.
echo 應用程式已結束。
pause
