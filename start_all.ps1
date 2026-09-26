# Set working directory to project folder
Set-Location $PSScriptRoot

Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host "  HUETTENCUP 2026 - ALL-IN-ONE STUDIO & TV SERVER" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Pruefe ob Node.js Server auf Port 3000 laeuft
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if ($conn) {
    Write-Host "[OK] Node.js Server laeuft bereits auf Port 3000." -ForegroundColor Green
} else {
    Write-Host "[..] Starte Node.js Server (server.js)..." -ForegroundColor Cyan
    Start-Process "cmd.exe" -ArgumentList "/k", "title Huettencup Server && node server.js" -WorkingDirectory $PSScriptRoot
    Start-Sleep -Seconds 2
}

Write-Host "[OK] Oeffne alle Browser-Seiten..." -ForegroundColor Green
Write-Host ""

# 2. Oeffne die 5 Browser-Seiten
Start-Process "http://localhost:3000/tv.html"
Start-Sleep -Milliseconds 400

Start-Process "http://localhost:3000/admin.html"
Start-Sleep -Milliseconds 400

Start-Process "http://localhost:3000/index.html"
Start-Sleep -Milliseconds 400

Start-Process "http://localhost:3000/guest.html"
Start-Sleep -Milliseconds 400

Start-Process "http://localhost:3000/showcase.html"

Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host "  Geoeffnete Seiten:" -ForegroundColor Yellow
Write-Host "  - TV Scoreboard:     http://localhost:3000/tv.html"
Write-Host "  - Admin-Zentrale:    http://localhost:3000/admin.html"
Write-Host "  - FUT-Karten-Studio: http://localhost:3000/index.html"
Write-Host "  - Gaeste-Erstellung: http://localhost:3000/guest.html"
Write-Host "  - 3D-Karten-Showcase:http://localhost:3000/showcase.html"
Write-Host ""
Write-Host "  Online Gaeste-Link:  https://ricfritzsche89.github.io/h-ttenkarten/guest.html"
Write-Host "  Chefin-Link (Nadine):https://ricfritzsche89.github.io/h-ttenkarten/guest.html?edition=img_chefin"
Write-Host "===============================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Fertig! Ziehe das TV-Fenster auf deinen TV/Beamer." -ForegroundColor Cyan
Start-Sleep -Seconds 5
