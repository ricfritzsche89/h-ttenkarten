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
echo [3/3] Starte TV-Player und Admin-Regie im schnellen App-Modus...

if defined BROWSER_BIN (
    :: TV-Screen als isolierte Vollbild-App mit erzwungener GPU-Hardwarebeschleunigung
    start "" "%BROWSER_BIN%" --app="http://localhost:3000/tv.html" --start-fullscreen --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --disable-extensions --user-data-dir="%TEMP%\HuettencupTvApp"
    
    :: Turnier-Regie fuer Laptop / Spielleitung
    start "" "%BROWSER_BIN%" --app="http://localhost:3000/admin.html" --ignore-gpu-blocklist --enable-gpu-rasterization
) else (
    :: Fallback Standard-Browser
    start "" "http://localhost:3000/tv.html"
    start "" "http://localhost:3000/admin.html"
)

echo.
echo ===============================================================================
echo   FERTIG! Das System laeuft jetzt im optimierten App-Modus!
echo.
echo   [TV]    Fernseher-Vollbild:  http://localhost:3000/tv.html
echo   [Admin] Laptop-Regie:        http://localhost:3000/admin.html
echo.
echo   Online-Link (Handy-Gaeste):  https://ricfritzsche89.github.io/h-ttenkarten/guest.html
echo   Chefin-Link (Nadine):        https://ricfritzsche89.github.io/h-ttenkarten/guest.html?edition=img_chefin
echo ===============================================================================
echo.
echo   TIPP ZUM BROWSER-FENSTER:
echo   - Ziehe das TV-Fenster auf deinen Fernseher / Beamer.
echo   - Druecke auf dem TV 'F' fuer Vollbild oder 'W' fuer die Oktoberfest-Lobby.
echo.
echo   OPTIONALE TOOLS OEFFNEN (Nur bei Bedarf):
echo   [1] FUT-Karten Studio (index.html)
echo   [2] 3D-Karten Showcase (showcase.html)
echo   [3] Gaeste-Ansicht testen (guest.html)
echo   [X] Fenster schliessen
echo.
set /p OPTION="Waehle eine Option (1-3) oder Enter zum Beenden: "

if "%OPTION%"=="1" start "" "http://localhost:3000/index.html"
if "%OPTION%"=="2" start "" "http://localhost:3000/showcase.html"
if "%OPTION%"=="3" start "" "http://localhost:3000/guest.html"
