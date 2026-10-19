@echo off
setlocal

rem 本檔以 ANSI（CP950 / Big5）儲存，cmd 才讀得懂中文；不要存成 UTF-8、不要加 chcp
rem 雙擊時的工作目錄不一定是專案根目錄，一律切到專案根目錄（這支腳本在 scripts\）
cd /d "%~dp0.."

rem 清除殘留的專案程序，只認這兩類：
rem   1. 執行檔位於本專案目錄下（bin\neutralino-win_x64.exe、dist 的 exe、node_modules 的 esbuild.exe）
rem   2. node.exe 且命令列指向本專案的 node_modules 工具鏈（vite / vitest / esbuild / neu）
rem 不採用「命令列含專案路徑」的寬鬆條件，那會誤殺開著本專案的編輯器與 agent
set "PROJ_DIR=%CD%\"

echo 正在清除殘留的專案程序...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=$env:PROJ_DIR.ToLower(); $subs=@('node_modules\vite\','node_modules\vitest\','node_modules\esbuild\','node_modules\@esbuild\','node_modules\@neutralinojs\','node_modules\.bin\'); $all=@(Get-CimInstance Win32_Process); $self=$PID; $anc=@(); $p=($all | Where-Object { $_.ProcessId -eq $self }).ParentProcessId; while ($p) { $anc+=$p; $p=($all | Where-Object { $_.ProcessId -eq $p }).ParentProcessId }; $hit=@($all | Where-Object { $q=$_; $anc -notcontains $q.ProcessId -and $q.ProcessId -ne $self -and (($q.ExecutablePath -and $q.ExecutablePath.ToLower().StartsWith($d)) -or ($q.Name -eq 'node.exe' -and $q.CommandLine -and (@($subs | Where-Object { $q.CommandLine.ToLower().Contains($d+$_) }).Count -gt 0))) }); $ids=@($hit | ForEach-Object { $_.ProcessId }); do { $new=@($all | Where-Object { $ids -contains $_.ParentProcessId -and $ids -notcontains $_.ProcessId -and $anc -notcontains $_.ProcessId -and $_.ProcessId -ne $self } | ForEach-Object { $_.ProcessId }); $ids+=$new } while ($new.Count -gt 0); if ($ids.Count -eq 0) { Write-Host '沒有發現殘留的專案程序。' } else { foreach ($i in $ids) { $n=($all | Where-Object { $_.ProcessId -eq $i }).Name; Stop-Process -Id $i -Force -ErrorAction SilentlyContinue; Write-Host ('已結束  ' + $i.ToString().PadLeft(6) + '  ' + $n) } }"

echo.
pause
