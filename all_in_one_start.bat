@echo off
chcp 65001 >nul
title Hüttencup All-In-One Studio
color 0E

echo ===============================================================================
echo   🏆 HÜTTENCUP 2026 - ALL-IN-ONE STUDIO ^& TV SERVER
echo ===============================================================================
echo.

:: 1. Prüfe ob Node.js Server bereits auf Port 3000 läuft
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Node.js Server läuft bereits auf Port 3000.
) else (
    echo [..] Starte Node.js Server auf Port 3000...
    start "Hüttencup Server" /min cmd /c "cd /d "%~dp0" && node server.js"
    timeout /t 2 /nobreak >nul
)

echo [OK] Öffne alle Browser-Seiten...
echo.

:: 2. TV-Scoreboard / Live-Display (für Fernseher / Beamer)
start http://localhost:3000/tv.html

:: 3. Admin-Konsole (Turnierleitung, Punkte, Timer, Soundboard, Wetten)
start http://localhost:3000/admin.html

:: 4. FUT Karten-Studio (Karten-Generator & Druck-Center)
start http://localhost:3000/index.html

:: 5. Gäste-Kartenersteller (Smartphone-Vorschau)
start http://localhost:3000/guest.html

:: 6. 3D-Karten-Showcase (Alle Designs)
start http://localhost:3000/showcase.html

echo ===============================================================================
echo   Folgende Seiten wurden in deinem Standard-Browser geöffnet:
echo.
echo   📺 TV Live-Display:     http://localhost:3000/tv.html
echo   👑 Admin-Zentrale:      http://localhost:3000/admin.html
echo   🃏 FUT Karten-Studio:   http://localhost:3000/index.html
echo   📱 Gäste-Erstellung:    http://localhost:3000/guest.html
echo   🖼️ 3D Showcase:         http://localhost:3000/showcase.html
echo.
echo   🌐 Live Gäste-Link (Smartphone / QR-Code):
echo      https://ricfritzsche89.github.io/h-ttenkarten/guest.html
echo.
echo   👑 Exklusiver Chefin-Link (Nadine):
echo      https://ricfritzsche89.github.io/h-ttenkarten/guest.html?edition=img_chefin
echo ===============================================================================
echo.
echo Tipp: Ziehe das TV-Fenster (tv.html) einfach rüber auf deinen TV-Bildschirm.
echo.
timeout /t 8 >nul
