Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot "..\public\icons\hikr-logo.png"
$size = 512
$bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function Brush($hex) {
    return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Pen($hex, $width) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($hex)), $width
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    return $pen
}

$ridge = New-Object System.Drawing.Drawing2D.GraphicsPath
$ridge.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(74, 374),
    [System.Drawing.PointF]::new(182, 198),
    [System.Drawing.PointF]::new(238, 276),
    [System.Drawing.PointF]::new(330, 130),
    [System.Drawing.PointF]::new(438, 374)
))
$graphics.FillPath((Brush "#12312b"), $ridge)

$highlight = New-Object System.Drawing.Drawing2D.GraphicsPath
$highlight.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(182, 198),
    [System.Drawing.PointF]::new(238, 276),
    [System.Drawing.PointF]::new(205, 264),
    [System.Drawing.PointF]::new(163, 286)
))
$highlight.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(330, 130),
    [System.Drawing.PointF]::new(438, 374),
    [System.Drawing.PointF]::new(340, 282),
    [System.Drawing.PointF]::new(276, 302)
))
$snow = Brush "#eef8f4"
$snow.Color = [System.Drawing.Color]::FromArgb(230, $snow.Color)
$graphics.FillPath($snow, $highlight)

$trail = Pen "#33d7c5" 34
$trailPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(152, 390),
    [System.Drawing.PointF]::new(214, 356),
    [System.Drawing.PointF]::new(256, 318),
    [System.Drawing.PointF]::new(270, 250),
    [System.Drawing.PointF]::new(322, 190),
    [System.Drawing.PointF]::new(359, 186)
)
$graphics.DrawCurve($trail, $trailPoints, 0.35)

$graphics.FillEllipse((Brush "#f5c542"), 128, 366, 48, 48)
$graphics.FillEllipse((Brush "#33d7c5"), 335, 162, 48, 48)
$arrowPen = Pen "#12312b" 14
$graphics.DrawLine($arrowPen, 337, 207, 374, 170)
$graphics.DrawLine($arrowPen, 347, 170, 375, 170)
$graphics.DrawLine($arrowPen, 375, 170, 375, 198)

$bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
