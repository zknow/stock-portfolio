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

echo 打包 Windows 執行檔（release）...
echo.
call npx neu build --release
if errorlevel 1 (
  echo.
  echo [錯誤] 打包失敗，請看上方訊息。
  pause
  exit /b 1
)

echo.
echo 打包完成，產物在：
echo   dist\stock-portfolio\stock-portfolio-win_x64.exe
echo   dist\stock-portfolio\resources.neu
echo   dist\stock-portfolio-release.zip
pause