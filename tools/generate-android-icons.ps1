$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'logo.png'
$androidRes = Join-Path $projectRoot 'android\app\src\main\res'

if (-not (Test-Path $sourcePath)) {
  throw "Ikon sumber tidak ditemukan: $sourcePath"
}

if (-not (Test-Path $androidRes)) {
  throw 'Proyek Android belum dibuat. Jalankan npm run android:add terlebih dahulu.'
}

Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile($sourcePath)
$densities = @{
  'mipmap-mdpi' = @{ icon = 48; foreground = 108 }
  'mipmap-hdpi' = @{ icon = 72; foreground = 162 }
  'mipmap-xhdpi' = @{ icon = 96; foreground = 216 }
  'mipmap-xxhdpi' = @{ icon = 144; foreground = 324 }
  'mipmap-xxxhdpi' = @{ icon = 192; foreground = 432 }
}

try {
  foreach ($density in $densities.Keys) {
    $directory = Join-Path $androidRes $density
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $size = [int]$densities[$density].icon
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.DrawImage($source, 0, 0, $size, $size)
      foreach ($iconName in @('ic_launcher.png', 'ic_launcher_round.png')) {
        $bitmap.Save((Join-Path $directory $iconName), [System.Drawing.Imaging.ImageFormat]::Png)
      }
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }

    $foregroundSize = [int]$densities[$density].foreground
    $foreground = New-Object System.Drawing.Bitmap($foregroundSize, $foregroundSize)
    $foregroundGraphics = [System.Drawing.Graphics]::FromImage($foreground)
    try {
      $foregroundGraphics.Clear([System.Drawing.Color]::Transparent)
      $foregroundGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $foregroundGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $inset = [int]($foregroundSize * 0.2)
      $artSize = $foregroundSize - ($inset * 2)
      $foregroundGraphics.DrawImage($source, $inset, $inset, $artSize, $artSize)
      $foreground.Save(
        (Join-Path $directory 'ic_launcher_foreground.png'),
        [System.Drawing.Imaging.ImageFormat]::Png
      )
    } finally {
      $foregroundGraphics.Dispose()
      $foreground.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

Write-Output 'Ikon Android berhasil dibuat dari logo.png.'
