Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
if (-not ([System.Management.Automation.PSTypeName]'Win32Helper').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Helper {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@ -ErrorAction SilentlyContinue
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host "  TV SCREEN NEUSTART - HUETTENCUP 2026" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""

# [1/3] Prüfen, ob Server auf Port 3000 läuft
Write-Host "[1/3] Pruefe Server auf Port 3000..." -ForegroundColor Cyan
$tcp = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $tcp) {
    Write-Host "  -> Server laeuft noch nicht. Starte Node.js Server..." -ForegroundColor Yellow
    Start-Process node -ArgumentList "server.js" -WorkingDirectory $PSScriptRoot
    Start-Sleep -Seconds 1
}

# Signalisiere Remote-Reload per API an beliebige offene TV-Tabs
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/restart_tv" -TimeoutSec 1 -ErrorAction SilentlyContinue
} catch {}

# [2/3] Alten TV-Screen beenden (NUR HuettencupTvApp, Admin & Server bleiben unberührt!)
Write-Host "[2/3] Beende vorherigen TV-Player..." -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' or Name = 'msedge.exe'" -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -match "HuettencupTvApp" 
} | ForEach-Object { 
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} 
}
Start-Sleep -Milliseconds 400

# [3/3] Browser und Bildschirme ermitteln & TV Screen starten
Write-Host "[3/3] Starte TV-Player frisch..." -ForegroundColor Cyan

$chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
    $chrome = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $chrome)) {
    $chrome = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}

$allScreens = [System.Windows.Forms.Screen]::AllScreens
$tvScreen = $allScreens | Where-Object { -not $_.Primary } | Select-Object -First 1

if ($tvScreen) {
    $tvX = $tvScreen.Bounds.X
    $tvY = $tvScreen.Bounds.Y
    $tvW = $tvScreen.Bounds.Width
    $tvH = $tvScreen.Bounds.Height
    Write-Host "  -> Fernseher erkannt ($tvW x $tvH)! Starte Kiosk-Vollbild auf TV..." -ForegroundColor Green
    $tvArgsList = @(
        "--kiosk",
        "http://localhost:3000/tv.html",
        "--window-position=$tvX,$tvY",
        "--window-size=$tvW,$tvH",
        "--start-fullscreen",
        "--kiosk-printing",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-pinch",
        "--overscroll-history-navigation=0",
        "--ignore-gpu-blocklist",
        "--enable-gpu-rasterization",
        "--enable-zero-copy",
        "--disable-extensions",
        "--user-data-dir=$env:TEMP\HuettencupTvApp"
    )
    $tvProc = Start-Process -FilePath $chrome -ArgumentList ($tvArgsList -join " ") -PassThru
    Start-Sleep -Milliseconds 600

    $tvWindow = Get-Process -Name chrome, msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*Hüttencup*" -or $_.MainWindowTitle -like "*tv.html*" -or $_.Id -eq $tvProc.Id } | Select-Object -First 1
    if ($tvWindow -and $tvWindow.MainWindowHandle -ne [IntPtr]::Zero) {
        [Win32Helper]::ShowWindow($tvWindow.MainWindowHandle, 3)
    }
} else {
    Write-Host "  -> 1 Bildschirm: Oeffne TV-Screen als separates App-Fenster..." -ForegroundColor Green
    $tvArgsList = @(
        "--app=http://localhost:3000/tv.html",
        "--user-data-dir=$env:TEMP\HuettencupTvApp",
        "--window-position=810,30",
        "--window-size=780,840",
        "--no-first-run",
        "--no-default-browser-check",
        "--ignore-gpu-blocklist",
        "--enable-gpu-rasterization"
    )
    Start-Process -FilePath $chrome -ArgumentList ($tvArgsList -join " ")
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  TV SCREEN WURDE ERFOLGREICH NEU GESTARTET!" -ForegroundColor Green
Write-Host "  (Server, Admin-Dashboard & Musik laufen ungestoert weiter)" -ForegroundColor Gray
Write-Host "===============================================================================" -ForegroundColor Green
Start-Sleep -Seconds 2
