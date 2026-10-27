@echo off
setlocal

rem Keep this file ASCII-only: cmd misparses non-ASCII text in batch files.
rem Double-click may start in another directory, so always cd to the project root (this script is in scripts\).
cd /d "%~dp0.."

rem Kill leftover project processes. Only two kinds are matched:
rem   1. Executable located under this project (bin\neutralino-win_x64.exe, the dist exe, node_modules esbuild.exe)
rem   2. node.exe whose command line points at this project's node_modules toolchain (vite / vitest / esbuild / neu)
rem Do not match on "command line contains the project path": that would also kill editors and agents that have this project open.
set "PROJ_DIR=%CD%\"

echo Killing leftover project processes...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=$env:PROJ_DIR.ToLower(); $subs=@('node_modules\vite\','node_modules\vitest\','node_modules\esbuild\','node_modules\@esbuild\','node_modules\@neutralinojs\','node_modules\.bin\'); $all=@(Get-CimInstance Win32_Process); $parent=@{}; foreach ($x in $all) { $parent[[int]$x.ProcessId]=[int]$x.ParentProcessId }; $self=$PID; $anc=@(); $p=$parent[$self]; while ($p) { $anc+=$p; $p=$parent[$p] }; $hit=@($all | Where-Object { $q=$_; $anc -notcontains $q.ProcessId -and $q.ProcessId -ne $self -and (($q.ExecutablePath -and $q.ExecutablePath.ToLower().StartsWith($d)) -or ($q.Name -eq 'node.exe' -and $q.CommandLine -and (@($subs | Where-Object { $q.CommandLine.ToLower().Contains($d+$_) }).Count -gt 0))) }); $ids=@($hit | ForEach-Object { $_.ProcessId }); do { $new=@($all | Where-Object { $ids -contains $_.ParentProcessId -and $ids -notcontains $_.ProcessId -and $anc -notcontains $_.ProcessId -and $_.ProcessId -ne $self } | ForEach-Object { $_.ProcessId }); $ids+=$new } while ($new.Count -gt 0); if ($ids.Count -eq 0) { Write-Host 'No leftover project processes found.' } else { foreach ($i in $ids) { $n=($all | Where-Object { $_.ProcessId -eq $i }).Name; Stop-Process -Id $i -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped  ' + $i.ToString().PadLeft(6) + '  ' + $n) } }"

echo.
pause
