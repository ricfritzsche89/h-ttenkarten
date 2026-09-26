Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Helper {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host "  HUETTENCUP 2026 - HIGH-PERFORMANCE ALL-IN-ONE LAUNCHER" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""

# [1/4] Server prüfen / starten
$serverConn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $serverConn) {
    Write-Host "[1/4] Starte Huettencup Server auf Port 3000..." -ForegroundColor Cyan
    Start-Process cmd.exe -ArgumentList "/k title Huettencup Server && node server.js" -WorkingDirectory $PSScriptRoot
    Start-Sleep -Seconds 2
    Write-Host "  -> Server erfolgreich gestartet!" -ForegroundColor Green
} else {
    Write-Host "[1/4] Server laeuft bereits auf Port 3000." -ForegroundColor Green
}

# [2/4] Browser ermitteln
$chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
    $chrome = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $chrome)) {
    $chrome = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}
Write-Host "[2/4] Verwende Browser: $chrome" -ForegroundColor Gray

# [3/4] TV-Bildschirm (Zweitmonitor) lokalisieren
$allScreens = [System.Windows.Forms.Screen]::AllScreens
$tvScreen = $allScreens | Where-Object { -not $_.Primary } | Select-Object -First 1

$tvPosArg = ""
$tvSizeArg = ""
if ($tvScreen) {
    $tvX = $tvScreen.Bounds.X
    $tvY = $tvScreen.Bounds.Y
    $tvW = $tvScreen.Bounds.Width
    $tvH = $tvScreen.Bounds.Height
    $tvPosArg = "--window-position=$tvX,$tvY"
    $tvSizeArg = "--window-size=$tvW,$tvH"
    Write-Host "[3/4] 47 Zoll TV-Bildschirm erkannt auf Position X=$tvX, Y=$tvY (${tvW}x${tvH})!" -ForegroundColor Green
    Write-Host "  -> TV-Ansicht wird DIREKT auf den Fernseher gebeamt!" -ForegroundColor Green
} else {
    Write-Host "[3/4] Nur 1 Bildschirm erkannt. TV-Ansicht oeffnet auf Hauptdisplay." -ForegroundColor Yellow
}

# Alte TV-Instanzen beenden, damit neue Vollbild-Flags greifen
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' or Name = 'msedge.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*HuettencupTvApp*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 300

# [4/4] 1. TV-Screen DIREKT auf dem Fernseher in Vollbild starten
Write-Host "[4/4] Starte TV-Player, Laptop-Regie und Spotify Lite..." -ForegroundColor Cyan

$tvArgsList = @(
    "--kiosk",
    "http://localhost:3000/tv.html"
)
if ($tvPosArg) { $tvArgsList += $tvPosArg }
if ($tvSizeArg) { $tvArgsList += $tvSizeArg }
$tvArgsList += @(
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
Start-Sleep -Milliseconds 800

# Windows SW_MAXIMIZE Failsafe
$tvWindow = Get-Process -Name chrome, msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*Hüttencup*" -or $_.MainWindowTitle -like "*tv.html*" -or $_.Id -eq $tvProc.Id } | Select-Object -First 1
if ($tvWindow -and $tvWindow.MainWindowHandle -ne [IntPtr]::Zero) {
    [Win32Helper]::ShowWindow($tvWindow.MainWindowHandle, 3)
}

# 2. Turnier-Regie fuer Laptop starten
Start-Sleep -Milliseconds 600
$regieArgsList = @(
    "--app=http://localhost:3000/admin.html",
    "--window-position=80,60",
    "--window-size=1100,780",
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization"
)
Start-Process -FilePath $chrome -ArgumentList ($regieArgsList -join " ")

# 3. Spotify Lite mit VOLLER Anti-Drosselung starten (Nie wieder Aussetzer!)
Start-Sleep -Milliseconds 600
$spotifyArgsList = @(
    "--app=https://open.spotify.com",
    "--user-data-dir=$env:LOCALAPPDATA\SpotifyLitePartyApp",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
    "--autoplay-policy=no-user-gesture-required",
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization"
)
Start-Process -FilePath $chrome -ArgumentList ($spotifyArgsList -join " ")

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  ALLES BEREIT! Das Party-System laeuft perfekt synchronisiert:" -ForegroundColor Green
Write-Host ""
Write-Host "  [TV]      Fernseher-Vollbild (DISPLAY 2): http://localhost:3000/tv.html" -ForegroundColor White
Write-Host "  [Admin]   Laptop-Regie:                   http://localhost:3000/admin.html" -ForegroundColor White
Write-Host "  [Musik]   Spotify Lite (Puffer-gefixt):   https://open.spotify.com" -ForegroundColor White
Write-Host ""
Write-Host "  Online-Link (Handy-Gaeste):  https://ricfritzsche89.github.io/h-ttenkarten/guest.html" -ForegroundColor Cyan
Write-Host "  Chefin-Link (Nadine):        https://ricfritzsche89.github.io/h-ttenkarten/guest.html?edition=img_chefin" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tastenkuerzel auf dem TV:" -ForegroundColor Gray
Write-Host "  - 'W' : Oktoberfest Willkommens-Lobby ein/ausschalten" -ForegroundColor Gray
Write-Host "  - 'F' : Vollbild umschalten" -ForegroundColor Gray
Write-Host "  - 'Q' : Smartphone-QR-Code aufrufen" -ForegroundColor Gray
Write-Host ""
Write-Host "Druecke eine beliebige Taste zum Beenden dieses Statusfensters..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
