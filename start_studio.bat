@echo off
title GUT Game Studio - Grillhütte Ultimate Team
color 0E

echo ========================================================
echo   STARTE GUT GAME STUDIO ^& 47" TV SCOREBOARD SERVER
echo ========================================================
echo.

:: Starte den Node.js Server im Hintergrund
start "GUT Studio Server" cmd /k "node server.js"

:: Warte 2 Sekunden bis der Server bereit ist
timeout /t 2 /nobreak >nul

:: Oeffne die TV-Scoreboard Seite im Standard-Browser
start http://localhost:3000/tv.html

echo.
echo Server laeuft! 
echo Ziehe den geoeffneten Browser-Tab auf deinen Fernseher.
echo.
