$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#154b43'))
$gold = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f1bf77'))
$white = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#fffaf0'), 15)
$white.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$white.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$white.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$rounded = [System.Drawing.Drawing2D.GraphicsPath]::new()
$rounded.AddArc(0, 0, 112, 112, 180, 90)
$rounded.AddArc(144, 0, 112, 112, 270, 90)
$rounded.AddArc(144, 144, 112, 112, 0, 90)
$rounded.AddArc(0, 144, 112, 112, 90, 90)
$rounded.CloseFigure()
$graphics.FillPath($background, $rounded)
$graphics.FillEllipse($gold, 50, 154, 54, 54)
$graphics.FillEllipse($gold, 95, 134, 54, 54)
$graphics.FillEllipse($gold, 140, 114, 54, 54)
$graphics.DrawLines($white, [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(54, 121), [System.Drawing.PointF]::new(104, 82),
  [System.Drawing.PointF]::new(140, 96), [System.Drawing.PointF]::new(195, 46)
))
$graphics.DrawLines($white, [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(158, 46), [System.Drawing.PointF]::new(195, 46),
  [System.Drawing.PointF]::new(195, 83)
))
$graphics.Dispose()
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = foreach ($size in $sizes) {
  $scaled = [System.Drawing.Bitmap]::new($size, $size)
  $canvas = [System.Drawing.Graphics]::FromImage($scaled)
  $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $canvas.DrawImage($bitmap, 0, 0, $size, $size)
  $stream = [System.IO.MemoryStream]::new()
  $scaled.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  ,($stream.ToArray())
  $canvas.Dispose()
  $scaled.Dispose()
  $stream.Dispose()
}
$output = [System.IO.File]::Create((Join-Path $PSScriptRoot 'icon.ico'))
$writer = [System.IO.BinaryWriter]::new($output)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($index = 0; $index -lt $sizes.Count; $index++) {
  $dimension = if ($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$images[$index].Length); $writer.Write([uint32]$offset)
  $offset += $images[$index].Length
}
foreach ($data in $images) { $writer.Write([byte[]]$data) }
$writer.Dispose()
$bitmap.Dispose(); $background.Dispose(); $gold.Dispose(); $white.Dispose(); $rounded.Dispose()
