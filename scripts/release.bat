@echo off
setlocal

rem 本檔以 ANSI（CP950 / Big5）儲存，cmd 才讀得懂中文；不要存成 UTF-8、不要加 chcp
rem 雙擊時的工作目錄不一定是專案根目錄，一律切到專案根目錄（這支腳本在 scripts\）
cd /d "%~dp0.."

if not exist "node_modules\" (
  echo 找不到 node_modules，先執行 npm install...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [錯誤] npm install 失敗，請確認 Node.js 與網路。
    pause
    exit /b 1
  )
  echo.
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
