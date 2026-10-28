Add-Type -AssemblyName System.Drawing
$projectPath=Split-Path $PSScriptRoot -Parent
function Read-River($relativePath,$worldHeight,$anchors){
 $bitmap=[System.Drawing.Bitmap]::new((Join-Path $projectPath $relativePath))
 $points=[System.Collections.Generic.List[object]]::new()
 try{
  for($y=0;$y -le $worldHeight;$y+=16){
   $i=0;while($i -lt $anchors.Count-2 -and $anchors[$i+1][0] -lt $y){$i++}
   $a=$anchors[$i];$b=$anchors[$i+1];$t=[Math]::Clamp(($y-$a[0])/($b[0]-$a[0]),0,1)
   $expected=$a[1]+($b[1]-$a[1])*$t
   $left=[int][Math]::Max(450,$expected-95);$right=[int][Math]::Min(900,$expected+95)
   $py=[Math]::Min($bitmap.Height-1,[int]($y*$bitmap.Height/$worldHeight))
   $hits=[System.Collections.Generic.List[int]]::new()
   for($x=$left;$x -le $right;$x++){
    $p=$bitmap.GetPixel([int]($x*$bitmap.Width/941),$py)
    if($p.R -lt 100 -and $p.G -gt 65 -and $p.B -gt 140 -and ($p.B-$p.G) -gt 25){$hits.Add($x)}
   }
   $bestScore=-1000;$best=@();$start=-1;$last=-1
   foreach($x in @($hits.ToArray())+@($right+100)){
    if($start -lt 0){$start=$x;$last=$x;continue}
    if($x-$last -gt 12){
     $length=$last-$start+1;$centre=($last+$start)/2;$score=$length-[Math]::Abs($centre-$expected)*.8
     if($score -gt $bestScore -and $length -gt 18){$bestScore=$score;$best=@($y,$centre,$length)}
     $start=$x
    };$last=$x
   }
   if($best.Count -eq 0){throw "River not detected: $relativePath at $y"}
   $points.Add($best)
  }
 }finally{$bitmap.Dispose()}
 return ,$points.ToArray()
}
$mainAnchors=@(@(0,647),@(100,596),@(200,594),@(300,668),@(400,718),@(500,744),@(600,698),@(700,631),@(800,605),@(900,656),@(1000,711),@(1100,743),@(1200,712),@(1300,663),@(1400,609),@(1500,635),@(1600,707),@(1672,748))
$patchAnchors=@(@(0,656),@(144,748),@(240,790),@(360,748),@(480,686),@(560,647),@(704,590))
$main=Read-River 'dist/assets/patchwork-ground-v13.png' 1672 $mainAnchors
$patch=Read-River 'dist/assets/patchwork-seam-v13.png' 704 $patchAnchors
$source='// River-only source corridors; blue fields are deliberately excluded.'+"`n"
$source+='export const MAIN_RIVER='+(ConvertTo-Json -InputObject $main -Compress)+';'+"`n"
$source+='export const PATCH_RIVER='+(ConvertTo-Json -InputObject $patch -Compress)+';'+"`n"
Set-Content -LiteralPath (Join-Path $projectPath 'dist/river-data.js') -Value $source -Encoding utf8
Write-Output "Measured main=$($main.Count), patch=$($patch.Count) river samples."
