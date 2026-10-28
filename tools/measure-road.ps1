Add-Type -AssemblyName System.Drawing
$projectPath = Split-Path $PSScriptRoot -Parent
function Read-Road($relativePath, $worldHeight) {
  $bitmap = [System.Drawing.Bitmap]::new((Join-Path $projectPath $relativePath))
  $points = [System.Collections.Generic.List[object]]::new()
  try {
    for ($worldY = 0; $worldY -le $worldHeight; $worldY += 16) {
      $py = [Math]::Min($bitmap.Height - 1, [int]($worldY * $bitmap.Height / $worldHeight))
      $start = -1; $bestStart = 0; $bestLength = 0
      for ($worldX = 60; $worldX -le 440; $worldX++) {
        $px = [Math]::Min($bitmap.Width - 1, [int]($worldX * $bitmap.Width / 941))
        $color = $bitmap.GetPixel($px, $py)
        $tan = $color.R -gt 100 -and $color.B -gt 55 -and ($color.R - $color.G) -gt 3 -and ($color.G - $color.B) -gt 12
        if ($tan -and $start -lt 0) { $start = $worldX }
        if ((-not $tan -or $worldX -eq 440) -and $start -ge 0) {
          $length = $worldX - $start
          if ($length -gt $bestLength) { $bestStart = $start; $bestLength = $length }
          $start = -1
        }
      }
      if ($bestLength -lt 8) { throw "Road not detected: $relativePath at $worldY" }
      $points.Add(@($worldY, ($bestStart + $bestLength / 2), $bestLength))
    }
  } finally { $bitmap.Dispose() }
  return ,$points.ToArray()
}
$mainPoints = Read-Road 'dist/assets/patchwork-ground-v13.png' 1672
$patchPoints = Read-Road 'dist/assets/patchwork-seam-v13.png' 704
$source = '// Measured from source pixels; coordinates use the unchanged 941-unit image width.' + "`n"
$source += 'export const MAIN_ROAD=' + (ConvertTo-Json -InputObject $mainPoints -Compress) + ';' + "`n"
$source += 'export const PATCH_ROAD=' + (ConvertTo-Json -InputObject $patchPoints -Compress) + ';' + "`n"
Set-Content -LiteralPath (Join-Path $projectPath 'dist/road-data.js') -Value $source -Encoding utf8
Write-Output "Measured main=$($mainPoints.Count), patch=$($patchPoints.Count) road samples."
