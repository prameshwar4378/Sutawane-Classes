Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\user\.gemini\antigravity\brain\09db7e98-f690-45c3-ab8b-c5a03fbb5a17\.user_uploaded\media_1792310247255_f4537f33.jpg"
$outIco = Join-Path $PSScriptRoot "icon.ico"
$outPng = Join-Path $PSScriptRoot "icon.png"
$backendLogo = Join-Path $PSScriptRoot "..\backend\prisma\logo-master.png"
$devPhotosLogo = Join-Path $PSScriptRoot "..\data\dev\photos\logo-master-1792115174632.png"
$frontendIcon = Join-Path $PSScriptRoot "..\frontend\public\icon.png"
$frontendLogo = Join-Path $PSScriptRoot "..\frontend\public\logo-master.png"
$appDataPhotosLogo = Join-Path $env:APPDATA "SutawaneClasses\data\photos\logo-master-1792115174632.png"

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)

# Save high-res master PNG
$srcBmp.Save($backendLogo, [System.Drawing.Imaging.ImageFormat]::Png)
$srcBmp.Save($devPhotosLogo, [System.Drawing.Imaging.ImageFormat]::Png)
$srcBmp.Save($frontendLogo, [System.Drawing.Imaging.ImageFormat]::Png)
if (Test-Path (Split-Path $appDataPhotosLogo)) {
    $srcBmp.Save($appDataPhotosLogo, [System.Drawing.Imaging.ImageFormat]::Png)
}

$sizes = @(256, 128, 64, 48, 32, 16)
$pngStreams = @()

foreach ($sz in $sizes) {
    $targetBmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($targetBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcBmp, 0, 0, $sz, $sz)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $targetBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    if ($sz -eq 256) {
        $targetBmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
        $targetBmp.Save($frontendIcon, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $targetBmp.Dispose()
    $pngStreams += $ms
}
$srcBmp.Dispose()

# Now construct ICO binary file
$icoStream = [System.IO.File]::Create($outIco)
$writer = New-Object System.IO.BinaryWriter($icoStream)

# Header
$writer.Write([UInt16]0) # Reserved
$writer.Write([UInt16]1) # Type: ICO
$writer.Write([UInt16]$sizes.Count) # Count

$offset = 6 + ($sizes.Count * 16)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $dataLen = [UInt32]$pngStreams[$i].Length

    $w = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }

    $writer.Write($w) # Width
    $writer.Write($h) # Height
    $writer.Write([byte]0) # Color palette
    $writer.Write([byte]0) # Reserved
    $writer.Write([UInt16]1) # Color planes
    $writer.Write([UInt16]32) # Bits per pixel
    $writer.Write($dataLen) # Data length
    $writer.Write([UInt32]$offset) # Data offset

    $offset += $dataLen
}

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bytes = $pngStreams[$i].ToArray()
    $writer.Write($bytes)
    $pngStreams[$i].Dispose()
}

$writer.Flush()
$icoStream.Close()

Write-Host "Generated icon.ico and icon.png successfully!"
Get-Item $outIco, $outPng | Select-Object Name, Length
