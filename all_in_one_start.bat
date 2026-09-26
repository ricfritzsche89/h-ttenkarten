@echo off
title Huettencup 2026 - All-In-One Studio ^& TV Player
color 0E

cd /d "%~dp0"

echo ===============================================================================
echo   HUETTENCUP 2026 - HIGH-PERFORMANCE TV PLAYER ^& ALL-IN-ONE STUDIO
echo ===============================================================================
echo.

echo [1/3] Pruefe Node.js Server auf Port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $c) { Start-Process cmd.exe -ArgumentList '/k title Huettencup Server && node server.js' -WorkingDirectory '%~dp0'; Start-Sleep -Seconds 2; Write-Host '  -> Server erfolgreich gestartet!' -ForegroundColor Green } else { Write-Host '  -> Server laeuft bereits auf Port 3000!' -ForegroundColor Green }"

echo.
echo [2/3] Ermittle besten Browser fuer hardwarebeschleunigten App-Modus...

set BROWSER_BIN=
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
    echo   -> Google Chrome GPU-App-Modus gefunden.
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_BIN=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    echo   -> Microsoft Edge GPU-App-Modus gefunden.
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_BIN=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    echo   -> Microsoft Edge GPU-App-Modus gefunden.
)

echo.
echo [3/3] Starte TV-Player, Admin-Regie und Spotify Lite...

if defined BROWSER_BIN (
    :: 1. TV-Screen als isolierte Vollbild-App mit erzwungener GPU-Hardwarebeschleunigung
    start "" "%BROWSER_BIN%" --app="http://localhost:3000/tv.html" --start-fullscreen --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --disable-extensions --user-data-dir="%TEMP%\HuettencupTvApp"
    
    :: 2. Turnier-Regie fuer Laptop / Spielleitung
    start "" "%BROWSER_BIN%" --app="http://localhost:3000/admin.html" --ignore-gpu-blocklist --enable-gpu-rasterization
    
    :: 3. Schlanker Spotify Party Player (Login bleibt im lokalen Profil dauerhaft gespeichert)
    start "" "%BROWSER_BIN%" --app="https://open.spotify.com" --user-data-dir="%LOCALAPPDATA%\SpotifyLitePartyApp" --ignore-gpu-blocklist --enable-gpu-rasterization
) else (
    :: Fallback Standard-Browser
    start "" "http://localhost:3000/tv.html"
    start "" "http://localhost:3000/admin.html"
    start "" "https://open.spotify.com"
)

echo.
echo ===============================================================================
echo   FERTIG! Das System laeuft jetzt im All-In-One Modus:
echo.
echo   [1] TV-Bildschirm:   http://localhost:3000/tv.html (Vollbild)
echo   [2] Turnier-Regie:   http://localhost:3000/admin.html (Laptop)
echo   [3] Party-Musik:     Spotify Lite Player (Eigenes schlankes Fenster)
echo.
echo   Online-Link (Handy-Gaeste):  https://ricfritzsche89.github.io/h-ttenkarten/guest.html
echo   Chefin-Link (Nadine):        https://ricfritzsche89.github.io/h-ttenkarten/guest.html?edition=img_chefin
echo ===============================================================================
echo.
echo   BEDIEN-TIPPS:
echo   - Ziehe das TV-Fenster auf deinen 47"-Fernseher.
echo   - Druecke auf dem TV 'W' fuer die Oktoberfest-Lobby oder 'F' fuer Vollbild.
echo   - Der Spotify Lite Player verbraucht nur einen Bruchteil des Speichers!
echo.
echo   OPTIONALE GENERATOREN (Nur bei Bedarf):
echo   [1] FUT-Karten Studio oeffnen (index.html)
echo   [2] 3D-Karten Showcase oeffnen (showcase.html)
echo   [3] Gaeste-Ansicht testen (guest.html)
echo   [M] Spotify Lite erneut oeffnen
echo.
set /p OPTION="Waehle eine Option (1-3, M) oder druecke Enter zum Beenden: "

if "%OPTION%"=="1" start "" "http://localhost:3000/index.html"
if "%OPTION%"=="2" start "" "http://localhost:3000/showcase.html"
if "%OPTION%"=="3" start "" "http://localhost:3000/guest.html"
if /I "%OPTION%"=="M" (
    if defined BROWSER_BIN (
        start "" "%BROWSER_BIN%" --app="https://open.spotify.com" --user-data-dir="%LOCALAPPDATA%\SpotifyLitePartyApp" --ignore-gpu-blocklist --enable-gpu-rasterization
    ) else (
        start "" "https://open.spotify.com"
    )
)
