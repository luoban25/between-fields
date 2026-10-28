Add-Type -AssemblyName System.Drawing
$projectPath=Split-Path $PSScriptRoot -Parent
function Read-WildRoad($relativePath,$height,$anchors){
 $bitmap=[System.Drawing.Bitmap]::new((Join-Path $projectPath $relativePath));$points=[System.Collections.Generic.List[object]]::new()
 try{
  for($y=0;$y -le $height;$y+=16){
   $i=0;while($i -lt $anchors.Count-2 -and $anchors[$i+1][0] -lt $y){$i++};$a=$anchors[$i];$b=$anchors[$i+1];$t=[Math]::Clamp(($y-$a[0])/($b[0]-$a[0]),0,1);$expected=$a[1]+($b[1]-$a[1])*$t
   $left=[int][Math]::Max(20,$expected-70);$right=[int][Math]::Min(420,$expected+70);$py=[Math]::Min($bitmap.Height-1,[int]($y*$bitmap.Height/$height))
   $start=-1;$bestScore=-1000;$best=@()
   for($x=$left;$x -le $right;$x++){
    $p=$bitmap.GetPixel([int]($x*$bitmap.Width/941),$py);$road=$p.R -gt 200 -and $p.G -gt 145 -and $p.B -gt 60 -and ($p.G-$p.B) -gt 40 -and ($p.R-$p.G) -lt 110
    if($road -and $start -lt 0){$start=$x}
    if((-not $road -or $x -eq $right) -and $start -ge 0){$width=$x-$start;$centre=($start+$x)/2;$score=$width-[Math]::Abs($centre-$expected)*.5;if($width -gt 12 -and $score -gt $bestScore){$best=@($y,$centre,$width);$bestScore=$score};$start=-1}
   }
   if($best.Count -eq 0){throw "Road not detected: $relativePath at $y"};$points.Add($best)
  }
 }finally{$bitmap.Dispose()};return ,$points.ToArray()
}
$main=Read-WildRoad 'dist/works/wilderness/assets/wilderness-ground-v17.png' 1672 @(@(0,316),@(400,270),@(800,220),@(1200,170),@(1672,105))
$patch=Read-WildRoad 'dist/works/wilderness/assets/wilderness-seam-v17.png' 704 @(@(0,125),@(144,105),@(320,180),@(480,280),@(560,315),@(704,301))
$source='// Measured bright dirt-road cores in the wilderness source images.'+"`n"+'export const MAIN_ROAD='+(ConvertTo-Json -InputObject $main -Compress)+';'+"`n"+'export const PATCH_ROAD='+(ConvertTo-Json -InputObject $patch -Compress)+';'+"`n"
Set-Content -LiteralPath (Join-Path $projectPath 'dist/works/wilderness/road-data.js') -Value $source -Encoding utf8
Write-Output "Measured wilderness road: main=$($main.Count), patch=$($patch.Count)."
