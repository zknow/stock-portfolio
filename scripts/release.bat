@echo off
setlocal

rem Keep this file ASCII-only: cmd misparses non-ASCII text in batch files.
rem Double-click may start in another directory, so always cd to the project root (this script is in scripts\).
cd /d "%~dp0.."
call "%~dp0prepare.bat"
if errorlevel 1 pause & exit /b 1

echo Building Windows executable (release)...
echo.
node "node_modules\@neutralinojs\neu\bin\neu.js" build --release
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. See the messages above.
  pause
  exit /b 1
)

echo.
echo Build complete. Output is in dist\.
pause
