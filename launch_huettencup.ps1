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

Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host "  HUETTENCUP 2026 - HIGH-PERFORMANCE ALL-IN-ONE LAUNCHER" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""

# [1/4] Server frisch und garantiert sauber starten
Write-Host "[1/4] Pruefe und starte Huettencup Server auf Port 3000..." -ForegroundColor Cyan

# A. Alle Prozesse beenden, die Port 3000 blockieren (verhindert EADDRINUSE)
$activePorts = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($activePorts) {
    $activePorts | ForEach-Object {
        try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
    Start-Sleep -Milliseconds 400
}

# B. Alte server.js Instanzen beenden
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*server.js*" } | ForEach-Object { 
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Milliseconds 300

# C. Server starten
Start-Process cmd.exe -ArgumentList '/k "title Huettencup Server && node server.js"' -WorkingDirectory $PSScriptRoot

# D. Aktiv warten (Polling), bis der Server WIRKLICH auf Port 3000 lauscht & antwortet
Write-Host "  Warte auf Initialisierung des Servers..." -NoNewline
$serverReady = $false
$maxAttempts = 30 # Bis zu 15 Sekunden
$attempts = 0

while (-not $serverReady -and $attempts -lt $maxAttempts) {
    Start-Sleep -Milliseconds 500
    $attempts++
    Write-Host "." -NoNewline
    
    $tcp = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($tcp) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/state" -TimeoutSec 1 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($resp -and $resp.StatusCode -eq 200) {
                $serverReady = $true
            }
        } catch {
            $serverReady = $true
        }
    }
}
Write-Host ""

if ($serverReady) {
    Write-Host "  -> Server erfolgreich gestartet und bereit auf Port 3000!" -ForegroundColor Green
} else {
    Write-Host "  [WARNUNG] Server brauchte ungewoehnlich lange. Starte Browser dennoch..." -ForegroundColor Yellow
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

# Alte Party-Browser-Instanzen beenden, damit neue Flags greifen
Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' or Name = 'msedge.exe'" -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -match "HuettencupTvApp|HuettencupAdminApp|SpotifyLitePartyApp" 
} | ForEach-Object { 
    try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} 
}
Start-Sleep -Milliseconds 400

# [4/4] TV-Player, Laptop-Regie und Spotify Lite starten
Write-Host "[4/4] Starte TV-Player, Laptop-Regie und Spotify Lite..." -ForegroundColor Cyan

if ($tvScreen) {
    # === 2 BILDSCHIRME: 47" Fernseher vorhanden! ===
    # 1. TV-Screen DIREKT auf dem Fernseher in Vollbild starten
    $tvArgsList = @(
        "--kiosk",
        "http://localhost:3000/tv.html",
        "--window-position=$($tvScreen.Bounds.X),$($tvScreen.Bounds.Y)",
        "--window-size=$($tvScreen.Bounds.Width),$($tvScreen.Bounds.Height)",
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

    # Windows SW_MAXIMIZE Failsafe fuer TV-Bildschirm
    $tvWindow = Get-Process -Name chrome, msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*Hüttencup*" -or $_.MainWindowTitle -like "*tv.html*" -or $_.Id -eq $tvProc.Id } | Select-Object -First 1
    if ($tvWindow -and $tvWindow.MainWindowHandle -ne [IntPtr]::Zero) {
        [Win32Helper]::ShowWindow($tvWindow.MainWindowHandle, 3)
    }

    # 2. Turnier-Regie fuer Laptop starten (Hauptbildschirm)
    Start-Sleep -Milliseconds 600
    $regieArgsList = @(
        "--app=http://localhost:3000/admin.html",
        "--user-data-dir=$env:TEMP\HuettencupAdminApp",
        "--window-position=40,40",
        "--window-size=1200,820",
        "--no-first-run",
        "--no-default-browser-check",
        "--ignore-gpu-blocklist",
        "--enable-gpu-rasterization"
    )
    Start-Process -FilePath $chrome -ArgumentList ($regieArgsList -join " ")
} else {
    # === 1 BILDSCHIRM: Laptop-Modus (Vorbereitung & Testen) ===
    # WICHTIG: KEIN Kiosk-Vollbild, damit beide Fenster nebeneinander sichtbar sind!
    Write-Host "  -> 1 Monitor: Oeffne TV (rechts) und Admin-Dashboard (links) nebeneinander!" -ForegroundColor Green

    # 1. TV-Screen auf rechter Bildschirmhaelfte
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
    $tvProc = Start-Process -FilePath $chrome -ArgumentList ($tvArgsList -join " ") -PassThru
    Start-Sleep -Milliseconds 600

    # 2. Turnier-Regie auf linker Bildschirmhaelfte
    $regieArgsList = @(
        "--app=http://localhost:3000/admin.html",
        "--user-data-dir=$env:TEMP\HuettencupAdminApp",
        "--window-position=10,30",
        "--window-size=790,840",
        "--no-first-run",
        "--no-default-browser-check",
        "--ignore-gpu-blocklist",
        "--enable-gpu-rasterization"
    )
    $regieProc = Start-Process -FilePath $chrome -ArgumentList ($regieArgsList -join " ") -PassThru
}

# 3. Spotify Lite mit VOLLER Anti-Drosselung starten (Nie wieder Aussetzer!)
Start-Sleep -Milliseconds 600
$spotifyArgsList = @(
    "--app=https://open.spotify.com",
    "--user-data-dir=$env:LOCALAPPDATA\SpotifyLitePartyApp",
    "--window-position=50,100",
    "--window-size=800,600",
    "--no-first-run",
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
Write-Host "  Foto-Upload (Live auf TV):   https://ricfritzsche89.github.io/h-ttenkarten/fotos.html" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tastenkuerzel auf dem TV:" -ForegroundColor Gray
Write-Host "  - 'W' : Oktoberfest Willkommens-Lobby ein/ausschalten" -ForegroundColor Gray
Write-Host "  - 'F' : Vollbild umschalten" -ForegroundColor Gray
Write-Host "  - 'Q' : Smartphone-QR-Code aufrufen" -ForegroundColor Gray
Write-Host ""
Write-Host "Druecke eine beliebige Taste zum Beenden dieses Statusfensters..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
