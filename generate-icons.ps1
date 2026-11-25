# Generate PWA App Icons for ISUZU RUSH
Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$rabbitPath = Join-Path $root "public\assets\brand\billboard_rabbit.png"
$rabbit = [System.Drawing.Image]::FromFile($rabbitPath)

$destDirs = @(
    (Join-Path $root "public\assets\icons"),
    (Join-Path $root "assets\icons")
)

foreach ($d in $destDirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

function Create-AppIcon {
    param(
        [int]$size,
        [bool]$isMaskable,
        [string]$outputPath
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(26, 29, 36),
        [System.Drawing.Color]::FromArgb(10, 11, 14),
        45.0
    )
    $g.FillRectangle($bgBrush, $rect)
    $bgBrush.Dispose()

    # Outer glow / racing red border if not maskable
    if (-not $isMaskable) {
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 0, 18), [Math]::Max(2, [int]($size * 0.03)))
        $g.DrawRectangle($pen, [int]($size * 0.015), [int]($size * 0.015), [int]($size * 0.97), [int]($size * 0.97))
        $pen.Dispose()
    }

    # Red decorative speed stripes in background
    $stripeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 230, 0, 18))
    $polyPoints = @(
        (New-Object System.Drawing.PointF([float]($size * 0.1), [float]0)),
        (New-Object System.Drawing.PointF([float]($size * 0.35), [float]0)),
        (New-Object System.Drawing.PointF([float]($size * 0.05), [float]$size)),
        (New-Object System.Drawing.PointF([float]0, [float]$size))
    )
    $g.FillPolygon($stripeBrush, $polyPoints)
    $stripeBrush.Dispose()

    # Mascot placement
    # Rabbit in safe area:
    # If maskable, safe zone is 80% (inner circle).
    $scale = if ($isMaskable) { 0.65 } else { 0.72 }
    $rabbitW = [int]($size * $scale)
    $rabbitH = [int]($rabbitW * ($rabbit.Height / $rabbit.Width))
    # Cap height
    $maxH = [int]($size * 0.68)
    if ($rabbitH -gt $maxH) {
        $rabbitH = $maxH
        $rabbitW = [int]($rabbitH * ($rabbit.Width / $rabbit.Height))
    }
    $rabbitX = [int](($size - $rabbitW) / 2)
    $rabbitY = [int]($size * 0.08)

    $g.DrawImage($rabbit, $rabbitX, $rabbitY, $rabbitW, $rabbitH)

    # Bottom badge banner "ISUZU RUSH"
    $badgeH = [int]($size * 0.22)
    $badgeY = [int]($size * 0.74)
    $badgeRect = New-Object System.Drawing.Rectangle(0, $badgeY, $size, $badgeH)

    # Red gradient badge
    $badgeBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $badgeRect,
        [System.Drawing.Color]::FromArgb(230, 0, 18),
        [System.Drawing.Color]::FromArgb(160, 0, 12),
        0.0
    )
    $g.FillRectangle($badgeBrush, $badgeRect)
    $badgeBrush.Dispose()

    # Gold top line for badge
    $goldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 215, 0), [Math]::Max(1, [int]($size * 0.02)))
    $g.DrawLine($goldPen, 0, $badgeY, $size, $badgeY)
    $goldPen.Dispose()

    # Font setup
    $fontSize = [float]($size * 0.11)
    $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Text shadow
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 0, 0, 0))
    $shadowRect = New-Object System.Drawing.RectangleF(1, [float]($badgeY + 2), [float]$size, [float]$badgeH)
    $g.DrawString("ISUZU RUSH", $font, $shadowBrush, $shadowRect, $stringFormat)
    $shadowBrush.Dispose()

    # Text white
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $textRect = New-Object System.Drawing.RectangleF(0, [float]$badgeY, [float]$size, [float]$badgeH)
    $g.DrawString("ISUZU RUSH", $font, $textBrush, $textRect, $stringFormat)
    $textBrush.Dispose()

    $font.Dispose()
    $stringFormat.Dispose()
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$sizes = @(
    @{ Name = "icon-192.png"; Size = 192; Maskable = $false },
    @{ Name = "icon-512.png"; Size = 512; Maskable = $false },
    @{ Name = "icon-180.png"; Size = 180; Maskable = $false },
    @{ Name = "apple-touch-icon.png"; Size = 180; Maskable = $false },
    @{ Name = "icon-maskable-192.png"; Size = 192; Maskable = $true },
    @{ Name = "icon-maskable-512.png"; Size = 512; Maskable = $true },
    @{ Name = "favicon.png"; Size = 64; Maskable = $false }
)

foreach ($d in $destDirs) {
    foreach ($item in $sizes) {
        $target = Join-Path $d $item.Name
        Create-AppIcon -size $item.Size -isMaskable $item.Maskable -outputPath $target
        Write-Host "Created $target ($($item.Size)x$($item.Size))"
    }
}

$rabbit.Dispose()
Write-Host "All icons generated successfully!"
