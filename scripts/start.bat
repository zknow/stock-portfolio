@echo off
setlocal

rem Keep this file ASCII-only: cmd misparses non-ASCII text in batch files.
rem Double-click may start in another directory, so always cd to the project root (this script is in scripts\).
cd /d "%~dp0.."
call "%~dp0prepare.bat"
if errorlevel 1 pause & exit /b 1

set "INSPECT=%~1"
if /i "%~1"=="inspector" (
  echo Starting desktop app with developer tools...
) else (
  echo Starting desktop app...
  echo Tip: pass the inspector argument to open developer tools, e.g. scripts\start.bat inspector
)
echo.

rem Clear leftovers from an earlier crash so this run starts clean.
call "%~dp0kill.bat" <nul >nul

rem The PowerShell launcher is stored below the PSBEGIN label of this file.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText('%~f0'); iex $s.Substring($s.LastIndexOf(':PSBEGIN')+8)"
set "RC=%ERRORLEVEL%"
call "%~dp0kill.bat" <nul >nul
if not "%RC%"=="0" pause
exit /b %RC%

:PSBEGIN
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct JobBasicLimit {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
}

[StructLayout(LayoutKind.Sequential)]
public struct JobIoCounters {
    public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
    public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
}

[StructLayout(LayoutKind.Sequential)]
public struct JobExtendedLimit {
    public JobBasicLimit Basic;
    public JobIoCounters Io;
    public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed;
    public UIntPtr PeakJobMemoryUsed;
}

public static class NativeJob {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
}
'@

# Closing this PowerShell process (exit, console close, Ctrl+C) closes the job handle, which kills the whole tree.
$job = [NativeJob]::CreateJobObject([IntPtr]::Zero, $null)
if ($job -eq [IntPtr]::Zero) { throw "CreateJobObject failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }

$basic = New-Object JobBasicLimit
$basic.LimitFlags = 0x2000
$ext = New-Object JobExtendedLimit
$ext.Basic = $basic
$size = [Runtime.InteropServices.Marshal]::SizeOf([type]'JobExtendedLimit')
$ptr = [Runtime.InteropServices.Marshal]::AllocHGlobal($size)
[Runtime.InteropServices.Marshal]::StructureToPtr($ext, $ptr, $false)
$ok = [NativeJob]::SetInformationJobObject($job, 9, $ptr, [uint32]$size)
[Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
if (-not $ok) { throw "SetInformationJobObject failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }

$neuArgs = @('node_modules\@neutralinojs\neu\bin\neu.js', 'run')
if ($env:INSPECT -eq 'inspector') { $neuArgs += @('--', '--window-enable-inspector') }
$proc = Start-Process -FilePath 'node' -ArgumentList $neuArgs -NoNewWindow -PassThru
if (-not [NativeJob]::AssignProcessToJobObject($job, $proc.Handle)) { throw "AssignProcessToJobObject failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }

$appName = 'neutralino-win_x64'
$deadline = (Get-Date).AddSeconds(60)
while (-not (Get-Process -Name $appName -ErrorAction SilentlyContinue)) {
    if ($proc.HasExited -or (Get-Date) -gt $deadline) {
        Write-Host ''
        Write-Host '[ERROR] The app did not start (or exited right away). See the messages above.'
        exit 1
    }
    Start-Sleep -Milliseconds 500
}
while (Get-Process -Name $appName -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 500 }

Write-Host ''
Write-Host 'App closed. Stopping neu run and Vite...'
exit 0
