@echo off
title Huettencup 2026 - All-In-One Studio
color 0E

cd /d "%~dp0"

echo ===============================================================================
echo   HUETTENCUP 2026 - ALL-IN-ONE STUDIO ^& TV SERVER
echo ===============================================================================
echo.

echo [1/2] Pruefe Node.js Server auf Port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $c) { Start-Process cmd.exe -ArgumentList '/k title Huettencup Server && node server.js' -WorkingDirectory '%~dp0'; Start-Sleep -Seconds 2; Write-Host 'Server gestartet!' -ForegroundColor Green } else { Write-Host 'Server laeuft bereits!' -ForegroundColor Green }"

echo.
echo [2/2] Oeffne alle 5 Browser-Seiten...
start "" "http://localhost:3000/tv.html"
start "" "http://localhost:3000/admin.html"
start "" "http://localhost:3000/index.html"
start "" "http://localhost:3000/guest.html"
start "" "http://localhost:3000/showcase.html"

echo.
echo ===============================================================================
echo   FERTIG! Folgende Seiten sind im Browser geoeffnet:
echo.
echo   [1] TV-Scoreboard (Grossbildschirm): http://localhost:3000/tv.html
echo   [2] Admin-Zentrale (Turnierleitung):  http://localhost:3000/admin.html
echo   [3] FUT-Karten-Studio (Generator):    http://localhost:3000/index.html
echo   [4] Gaeste-Erstellung (Smartphone):   http://localhost:3000/guest.html
echo   [5] 3D-Karten-Showcase (Galerie):     http://localhost:3000/showcase.html
echo.
echo   Online-Link (Handy-Gaeste): https://ricfritzsche89.github.io/h-ttenkarten/guest.html
echo   Chefin-Link (Nadine):       https://ricfritzsche89.github.io/h-ttenkarten/guest.html?edition=img_chefin
echo ===============================================================================
echo.
echo Ziehe den TV-Tab (tv.html) auf deinen Fernseher / Beamer.
echo.
echo Druecke eine beliebige Taste zum Beenden dieses Fensters...
pause >nul
