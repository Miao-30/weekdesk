$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetsDir = Join-Path $PSScriptRoot '..\assets'
[System.IO.Directory]::CreateDirectory($assetsDir) | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = 'AntiAlias'
$graphics.Clear([System.Drawing.Color]::FromArgb(59,119,104))
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244,250,244))
$graphics.FillRectangle($brush,48,60,160,148)
$greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(59,119,104))
$graphics.FillRectangle($greenBrush,48,82,160,14)
foreach($x in @(74,119,164)){foreach($y in @(118,158)){$graphics.FillRectangle($greenBrush,$x,$y,22,22)}}
$graphics.FillRectangle($brush,76,40,12,32)
$graphics.FillRectangle($brush,169,40,12,32)
$pngPath=Join-Path $assetsDir 'icon.png'
$bitmap.Save($pngPath,[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose(); $brush.Dispose(); $greenBrush.Dispose()
$pngBytes=[System.IO.File]::ReadAllBytes($pngPath)
$stream=[System.IO.File]::Create((Join-Path $assetsDir 'icon.ico'))
$writer=New-Object System.IO.BinaryWriter $stream
$writer.Write([UInt16]0);$writer.Write([UInt16]1);$writer.Write([UInt16]1)
$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0)
$writer.Write([UInt16]1);$writer.Write([UInt16]32);$writer.Write([UInt32]$pngBytes.Length);$writer.Write([UInt32]22)
$writer.Write($pngBytes);$writer.Dispose();$stream.Dispose()
