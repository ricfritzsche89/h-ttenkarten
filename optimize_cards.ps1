Add-Type -AssemblyName System.Drawing

$cardsDir = Join-Path $PSScriptRoot "cards"
$backupDir = Join-Path $cardsDir "originals_hd"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$files = Get-ChildItem -Path $cardsDir -Filter "*.png"

Write-Host "Starte Optimierung der Spielerkarten..." -ForegroundColor Cyan

foreach ($file in $files) {
    if ($file.Length -lt 50000) { continue } # Skip tiny or placeholder files
    
    $fullPath = $file.FullName
    $backupPath = Join-Path $backupDir $file.Name
    
    try {
        $srcBytes = [System.IO.File]::ReadAllBytes($fullPath)
        $ms = New-Object System.IO.MemoryStream($srcBytes, $false)
        $srcImg = [System.Drawing.Image]::FromStream($ms)
        
        $origW = $srcImg.Width
        $origH = $srcImg.Height
        
        if ($origH -gt 1400) {
            $targetH = 1400
            $scale = $targetH / $origH
            $targetW = [int][Math]::Round($origW * $scale)
            
            # 1. Sicherungskopie im HD-Ordner anlegen
            if (-not (Test-Path $backupPath)) {
                [System.IO.File]::Copy($fullPath, $backupPath, $true)
            }
            
            # 2. Hochqualitative Skalierung mit Bikubischer Interpolation
            $destBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $graphics = [System.Drawing.Graphics]::FromImage($destBmp)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.Clear([System.Drawing.Color]::Transparent)
            
            $graphics.DrawImage($srcImg, 0, 0, $targetW, $targetH)
            
            $srcImg.Dispose()
            $ms.Dispose()
            $graphics.Dispose()
            
            $tempPath = $fullPath + ".tmp"
            $destBmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $destBmp.Dispose()
            
            Remove-Item -Path $fullPath -Force
            Rename-Item -Path $tempPath -NewName $file.Name
            
            $newSize = (Get-Item $fullPath).Length
            $origSizeMB = [Math]::Round($file.Length / 1MB, 2)
            $newSizeMB = [Math]::Round($newSize / 1MB, 2)
            $savings = [Math]::Round((1 - ($newSize / $file.Length)) * 100, 1)
            
            Write-Host ("  [OK] " + $file.Name + " (" + $origW + "x" + $origH + " -> " + $targetW + "x" + $targetH + "): " + $origSizeMB + " MB -> " + $newSizeMB + " MB (-" + $savings + "%)") -ForegroundColor Green
        } else {
            $srcImg.Dispose()
            $ms.Dispose()
            Write-Host ("  [SKIP] " + $file.Name + " ist bereits optimiert (" + $origW + "x" + $origH + ")") -ForegroundColor DarkGray
        }
    } catch {
        Write-Host ("  [FEHLER] bei " + $file.Name + ": " + $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Host "Optimierung abgeschlossen! Alle HD-Originale wurden in 'cards/originals_hd' gesichert." -ForegroundColor Green
