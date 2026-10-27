@echo off
setlocal

rem Keep this file ASCII-only: cmd misparses non-ASCII text in batch files.
rem Prepares start.bat and release.bat: framework binary in bin\ and npm dependencies.
cd /d "%~dp0.."

if exist "bin\neutralino-win_x64.exe" goto check_deps

for /f "tokens=2 delims=:, " %%v in ('findstr /c:"binaryVersion" neutralino.config.json') do set "VER=%%~v"
if not defined VER (
  echo [ERROR] cannot read cli.binaryVersion from neutralino.config.json
  exit /b 1
)

set "ZIP=neutralinojs-v%VER%.zip"
set "URL=https://github.com/neutralinojs/neutralinojs/releases/download/v%VER%/%ZIP%"
echo bin\neutralino-win_x64.exe not found, downloading Neutralinojs v%VER% ...
mkdir "bin" 2>nul

curl.exe -sS -L -f --noproxy "*" -o "bin\%ZIP%" "%URL%"
if errorlevel 1 (
  echo direct download failed, retrying with system proxy...
  curl.exe -sS -L -f -o "bin\%ZIP%" "%URL%"
)
if errorlevel 1 (
  echo [ERROR] download failed: %ZIP%
  exit /b 1
)

tar.exe -xf "bin\%ZIP%" -C "bin" "neutralino-win_x64.exe"
if errorlevel 1 (
  echo [ERROR] extract failed: %ZIP%
  exit /b 1
)

del /q "bin\%ZIP%" 2>nul
echo Done.
echo.

:check_deps
if exist "node_modules\" exit /b 0

echo node_modules not found, running npm install...
echo.
call npm install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed. Check Node.js and network.
  exit /b 1
)
echo.
exit /b 0
