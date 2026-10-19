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

if /i "%~1"=="inspector" (
  set "NEU_ARGS=run -- --window-enable-inspector"
  echo 啟動桌面應用程式（附開發者工具）...
) else (
  set "NEU_ARGS=run"
  echo 啟動桌面應用程式...
  echo 提示：加參數 inspector 可開啟開發者工具，例如 scripts\start.bat inspector
)
echo.

rem neu run 在 app 關閉後不會自己結束（Vite 續跑），所以背景啟動，這裡等 app 關掉再收尾。
rem 直接跑本地 CLI 而不經 npx：少一層行程，kill.bat 的判準才涵蓋整條鏈。
start "" /b node "node_modules\@neutralinojs\neu\bin\neu.js" %NEU_ARGS%

rem 等 app 出現（最多 60 秒，每輪 tasklist 間隔約 1 秒），出現後再等它被關掉
set /a TICKS=0
:wait_launch
ping -n 2 127.0.0.1 >nul
tasklist /fi "imagename eq neutralino-win_x64.exe" 2>nul | find /i "neutralino-win_x64.exe" >nul
if not errorlevel 1 goto wait_close
set /a TICKS+=1
if %TICKS% lss 60 goto wait_launch

echo.
echo [錯誤] 應用程式沒有啟動（或啟動後立即結束），請看上方訊息。
call "%~dp0kill.bat" <nul >nul
pause
exit /b 1

:wait_close
ping -n 2 127.0.0.1 >nul
tasklist /fi "imagename eq neutralino-win_x64.exe" 2>nul | find /i "neutralino-win_x64.exe" >nul
if not errorlevel 1 goto wait_close

echo.
echo 應用程式已結束，收掉 neu run 與 Vite...
call "%~dp0kill.bat" <nul >nul
exit /b 0
