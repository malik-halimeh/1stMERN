param(
  [string]$DataPath = (Join-Path $PSScriptRoot 'presentation-data.json'),
  [string]$OutputPath = (Join-Path $PSScriptRoot 'OptiCart-Business-Presentation.pptx')
)

$ErrorActionPreference = 'Stop'
$data = Get-Content -Raw -Encoding UTF8 -LiteralPath $DataPath | ConvertFrom-Json
$W = 960.0; $H = 540.0
$C = @{
  bg='FAFAF9'; surface='FFFFFF'; ink='1C1917'; secondary='57534E'; muted='A8A29E'; line='E7E5E4'; soft='F5F5F4';
  orange='EA580C'; orangeDark='9A3412'; orangeDeep='7C2D12'; teal='0D9488'; red='DC2626'; green='16A34A'; blue='0284C7'
}

function OColor([string]$hex) {
  $hex=$hex.TrimStart('#'); if($hex.Length -ne 6){ $stack=(Get-PSCallStack | ForEach-Object { "$($_.FunctionName):$($_.ScriptLineNumber)" }) -join ' <- '; throw "Invalid color value '$hex' at $stack" }; $r=[Convert]::ToInt32($hex.Substring(0,2),16); $g=[Convert]::ToInt32($hex.Substring(2,2),16); $b=[Convert]::ToInt32($hex.Substring(4,2),16)
  return $r + ($g * 256) + ($b * 65536)
}
function Set-Fill($shape,[string]$hex,[double]$trans=0) { $shape.Fill.Visible=-1; $shape.Fill.Solid(); $shape.Fill.ForeColor.RGB=OColor $hex; $shape.Fill.Transparency=$trans }
function Set-Line($shape,[string]$hex,[double]$weight=1,[double]$trans=0) { $shape.Line.Visible=-1; $shape.Line.ForeColor.RGB=OColor $hex; $shape.Line.Weight=$weight; $shape.Line.Transparency=$trans }
function Add-Rect($slide,[double]$x,[double]$y,[double]$w,[double]$h,[string]$fill,[string]$line='',[double]$radius=0) {
  $type = if($radius -gt 0){5}else{1}; $s=$slide.Shapes.AddShape($type,$x,$y,$w,$h); Set-Fill $s $fill
  if($line){Set-Line $s $line}else{$s.Line.Visible=0}; return $s
}
function Add-Line($slide,[double]$x1,[double]$y1,[double]$x2,[double]$y2,[string]$color,[double]$weight=1) { $s=$slide.Shapes.AddLine($x1,$y1,$x2,$y2); Set-Line $s $color $weight; return $s }
function Add-Text($slide,[string]$text,[double]$x,[double]$y,[double]$w,[double]$h,[double]$size,[string]$color,[bool]$bold=$false,[string]$align='left',[string]$font='Inter') {
  $s=$slide.Shapes.AddTextbox(1,$x,$y,$w,$h); $s.Line.Visible=0; $s.Fill.Visible=0
  $tf=$s.TextFrame; $tf.MarginLeft=0; $tf.MarginRight=0; $tf.MarginTop=0; $tf.MarginBottom=0; $tf.WordWrap=-1
  $tr=$tf.TextRange; $tr.Text=$text; $tr.Font.Name=$font; $tr.Font.Size=$size; $tr.Font.Bold=if($bold){-1}else{0}; $tr.Font.Color.RGB=OColor $color
  $tr.ParagraphFormat.Alignment = switch($align){'center'{2};'right'{3};default{1}}
  return $s
}
function Add-Pill($slide,[string]$text,[double]$x,[double]$y,[double]$w,[string]$fill,[string]$color) {
  $s=Add-Rect $slide $x $y $w 24 $fill '' 10; $t=Add-Text $slide $text $x ($y+5) $w 14 9 $color $true 'center'; return @($s,$t)
}
function Add-ImageFrame($slide,[string]$path,[double]$x,[double]$y,[double]$w,[double]$h,[string]$border='E7E5E4') {
  $shadow=Add-Rect $slide ($x+4) ($y+5) $w $h 'D6D3D1' '' 10; $shadow.Fill.Transparency=0.55
  $frame=Add-Rect $slide ($x-2) ($y-2) ($w+4) ($h+4) 'FFFFFF' $border 10
  $pic=$slide.Shapes.AddPicture((Resolve-Path $path).Path,0,-1,$x,$y,$w,$h); return $pic
}
function Add-Header($slide,$sd,[string]$kicker='OPTICART') {
  Add-Rect $slide 0 0 9 540 $C.orange | Out-Null
  Add-Text $slide $kicker 42 24 410 18 10 $C.orange $true | Out-Null
  Add-Text $slide $sd.slide_title 42 50 850 46 26 $C.ink $true | Out-Null
  Add-Text $slide $sd.primary_business_message 42 98 845 28 12 $C.secondary $false | Out-Null
}
function Add-Footer($slide,$sd,[string]$bg='FAFAF9') {
  Add-Line $slide 42 507 918 507 $C.line 0.75 | Out-Null
  Add-Pill $slide ($sd.presenter.ToUpper()) 42 512 66 $C.soft $C.orangeDark | Out-Null
  Add-Text $slide ("{0:D2} / {1:D2}" -f [int]$sd.slide_number,[int]$data.slides.Count) 858 516 60 14 8 $C.muted $true 'right' | Out-Null
}
function Add-Stage($slide,[string]$num,[string]$title,[string]$detail,[double]$y,[string]$accent) {
  $circle=Add-Rect $slide 635 $y 25 25 $accent '' 12; Add-Text $slide $num 635 ($y+5) 25 13 8 'FFFFFF' $true 'center' | Out-Null
  Add-Text $slide $title 674 ($y-1) 210 20 13 $C.ink $true | Out-Null
  Add-Text $slide $detail 674 ($y+20) 215 19 9.5 $C.secondary $false | Out-Null
}
function Add-Insight($slide,[string]$label,[string]$detail,[double]$y,[string]$accent) {
  Add-Rect $slide 43 $y 4 45 $accent | Out-Null
  Add-Text $slide $label 62 ($y-1) 260 20 13 $C.ink $true | Out-Null
  Add-Text $slide $detail 62 ($y+20) 260 28 9.5 $C.secondary $false | Out-Null
}

$pp=New-Object -ComObject PowerPoint.Application
$pres=$null
try {
  $pres=$pp.Presentations.Add()
  $pres.PageSetup.SlideWidth=$W; $pres.PageSetup.SlideHeight=$H
  foreach($sd in $data.slides) {
    $slide=$pres.Slides.Add($pres.Slides.Count+1,12)
    $slide.FollowMasterBackground=0; $slide.Background.Fill.Solid(); $slide.Background.Fill.ForeColor.RGB=OColor $C.bg
    switch($sd.visual_layout) {
      'cover_storefront' {
        $slide.Background.Fill.ForeColor.RGB=OColor $C.orangeDark
        Add-Text $slide 'Opti' 52 36 61 28 20 'FFFFFF' $true | Out-Null
        Add-Text $slide 'Cart' 105 36 61 28 20 $C.orange $true | Out-Null
        Add-Pill $slide 'BUSINESS PRESENTATION' 52 99 155 $C.teal 'FFFFFF' | Out-Null
        Add-Text $slide $sd.slide_title 52 142 395 112 38 'FFFFFF' $true | Out-Null
        Add-Text $slide 'From product discovery to business decision.' 52 274 360 50 16 'FDEDE4' $false | Out-Null
        Add-Text $slide 'A complete appliance commerce platform' 52 365 330 22 10 'F7C6AF' $true | Out-Null
        $img=Join-Path $PSScriptRoot $sd.visual_references[0].path
        Add-ImageFrame $slide $img 487 54 421 263 'C2410C' | Out-Null
        Add-Rect $slide 487 331 421 115 $C.orangeDeep '' 10 | Out-Null
        Add-Text $slide 'CUSTOMER JOURNEY' 511 353 160 16 9 'F7C6AF' $true | Out-Null
        Add-Text $slide 'BUSINESS CONTROL' 723 353 160 16 9 'F7C6AF' $true 'right' | Out-Null
        Add-Line $slide 523 398 870 398 'F97316' 3 | Out-Null
        Add-Rect $slide 688 386 24 24 $C.orange '' 12 | Out-Null
        Add-Text $slide '<->' 688 391 24 14 8 'FFFFFF' $true 'center' | Out-Null
        Add-Pill $slide ($sd.presenter.ToUpper()) 52 483 66 'FDEDE4' $C.orangeDark | Out-Null
        Add-Text $slide '01 / 06' 848 488 60 14 8 'F7C6AF' $true 'right' | Out-Null
      }
      'two_pillars' {
        Add-Header $slide $sd 'THE BUSINESS NEED'
        Add-Rect $slide 42 153 374 293 'FFFFFF' $C.line 12 | Out-Null
        Add-Rect $slide 544 153 374 293 'FFF7ED' 'FED7AA' 12 | Out-Null
        Add-Rect $slide 70 181 42 42 $C.teal '' 12 | Out-Null; Add-Text $slide 'C' 70 190 42 22 15 'FFFFFF' $true 'center' | Out-Null
        Add-Text $slide 'Customer experience' 70 239 280 26 18 $C.ink $true | Out-Null
        Add-Text $slide 'Discover clearly' 70 289 250 20 12 $C.ink $true | Out-Null
        Add-Text $slide 'Keep saved choices' 70 326 250 20 12 $C.ink $true | Out-Null
        Add-Text $slide 'Know what happens next' 70 363 270 20 12 $C.ink $true | Out-Null
        Add-Rect $slide 572 181 42 42 $C.orange '' 12 | Out-Null; Add-Text $slide 'B' 572 190 42 22 15 'FFFFFF' $true 'center' | Out-Null
        Add-Text $slide 'Business operations' 572 239 290 26 18 $C.ink $true | Out-Null
        Add-Text $slide 'See orders needing action' 572 289 285 20 12 $C.ink $true | Out-Null
        Add-Text $slide 'Protect product availability' 572 326 285 20 12 $C.ink $true | Out-Null
        Add-Text $slide 'Learn from activity' 572 363 270 20 12 $C.ink $true | Out-Null
        Add-Line $slide 416 299 544 299 $C.orange 3 | Out-Null
        Add-Rect $slide 456 268 48 61 $C.orangeDark '' 12 | Out-Null; Add-Text $slide '<->' 456 289 48 18 12 'FFFFFF' $true 'center' | Out-Null
        Add-Pill $slide 'SHARED DATA' 437 348 86 $C.soft $C.orangeDark | Out-Null
        Add-Footer $slide $sd
      }
      'customer_journey' {
        Add-Header $slide $sd 'PILLAR 1 - CUSTOMER EXPERIENCE'
        $img=Join-Path $PSScriptRoot $sd.visual_references[0].path
        Add-ImageFrame $slide $img 42 151 557 348 | Out-Null
        Add-Line $slide 647 176 647 439 $C.line 2 | Out-Null
        Add-Stage $slide '1' 'Discover' 'Categories, search, filters' 166 $C.teal
        Add-Stage $slide '2' 'Evaluate' 'Variants, ratings, reviews' 222 $C.orange
        Add-Stage $slide '3' 'Save' 'Guest cart and wishlist' 278 $C.orangeDark
        Add-Stage $slide '4' 'Complete' 'Coupon and checkout' 334 $C.orange
        Add-Stage $slide '5' 'Stay informed' 'History, updates, feedback' 390 $C.teal
        Add-Pill $slide 'REAL PRODUCT UI' 454 465 123 $C.surface $C.orangeDark | Out-Null
        Add-Footer $slide $sd
      }
      'operations_control' {
        Add-Header $slide $sd 'PILLAR 2 - BUSINESS OPERATIONS'
        Add-Insight $slide 'Fulfillment control' 'Move orders through clear statuses and keep customers informed.' 165 $C.orange
        Add-Insight $slide 'Inventory awareness' 'Threshold alerts surface stock risk before it becomes a surprise.' 247 $C.red
        Add-Insight $slide 'Procurement traceability' 'Supplier purchases update stock and capture cost together.' 329 $C.teal
        Add-Pill $slide 'ROLE-BASED CONTROLS + AUDIT LOGS' 43 421 250 $C.soft $C.orangeDark | Out-Null
        $img=Join-Path $PSScriptRoot $sd.visual_references[0].path
        Add-ImageFrame $slide $img 344 140 574 359 | Out-Null
        Add-Pill $slide 'REPRESENTATIVE LOCAL TEST DATA' 683 466 215 $C.surface $C.secondary | Out-Null
        Add-Footer $slide $sd
      }
      'analytics_visibility' {
        Add-Header $slide $sd 'MANAGEMENT VISIBILITY'
        Add-Insight $slide 'Performance' 'Delivered revenue, order volume, average order value.' 170 $C.orange
        Add-Insight $slide 'Demand' 'Customer growth and top-selling SKUs.' 257 $C.teal
        Add-Insight $slide 'Investment' 'Supplier purchase spend and units bought.' 344 $C.orangeDark
        Add-Pill $slide 'IMPLEMENTED ANALYTICS VIEWS' 43 438 190 $C.soft $C.orangeDark | Out-Null
        $img=Join-Path $PSScriptRoot $sd.visual_references[0].path
        Add-ImageFrame $slide $img 341 140 577 361 | Out-Null
        Add-Pill $slide 'ILLUSTRATIVE TEST DATA - NOT COMMERCIAL RESULTS' 617 466 281 $C.surface $C.secondary | Out-Null
        Add-Footer $slide $sd
      }
      'closing_product' {
        $slide.Background.Fill.ForeColor.RGB=OColor $C.ink
        Add-Text $slide 'OPTICART' 52 32 120 18 10 $C.orange $true | Out-Null
        Add-Text $slide $sd.slide_title 52 75 650 48 30 'FFFFFF' $true | Out-Null
        Add-Text $slide 'The value is in the connection.' 52 128 500 28 15 'D6D3D1' $false | Out-Null
        Add-Rect $slide 52 199 343 180 '292524' '44403C' 12 | Out-Null
        Add-Text $slide 'CUSTOMER EXPERIENCE' 78 224 270 18 9 $C.teal $true | Out-Null
        Add-Text $slide 'A journey that can complete a sale' 78 263 265 55 20 'FFFFFF' $true | Out-Null
        Add-Text $slide 'discover  -  decide  -  buy  -  track' 78 334 260 20 10 'A8A29E' $false | Out-Null
        Add-Rect $slide 565 199 343 180 '292524' '44403C' 12 | Out-Null
        Add-Text $slide 'BUSINESS OPERATIONS' 591 224 270 18 9 $C.orange $true | Out-Null
        Add-Text $slide 'A workflow that can fulfill and learn' 591 263 272 55 20 'FFFFFF' $true | Out-Null
        Add-Text $slide 'control  -  monitor  -  improve' 591 334 260 20 10 'A8A29E' $false | Out-Null
        Add-Line $slide 395 289 565 289 $C.orange 3 | Out-Null
        Add-Rect $slide 448 256 64 64 $C.orange '' 20 | Out-Null; Add-Text $slide '<->' 448 277 64 22 15 'FFFFFF' $true 'center' | Out-Null
        Add-Text $slide 'Ready to contribute to real business software.' 52 422 720 34 20 'FFFFFF' $true | Out-Null
        Add-Text $slide 'Complete MERN application - real workflows - clear responsibilities' 52 465 700 20 10 'A8A29E' $false | Out-Null
        Add-Pill $slide ($sd.presenter.ToUpper()) 52 503 66 '44403C' 'F5F5F4' | Out-Null
        Add-Text $slide 'Thank you.' 780 505 128 22 13 $C.orange $true 'right' | Out-Null
      }
    }
    $slide.Tags.Add('Presenter',[string]$sd.presenter)
    $slide.Tags.Add('CanonicalSlideNumber',[string]$sd.slide_number)
  }
  if(Test-Path $OutputPath){ Remove-Item -LiteralPath $OutputPath -Force }
  $pres.SaveAs($OutputPath,24)
  $renderDir=Join-Path $PSScriptRoot 'rendered-slides'; New-Item -ItemType Directory -Force -Path $renderDir | Out-Null
  $pres.Export($renderDir,'PNG',1600,900)
} finally {
  if($pres){$pres.Close()}
  $pp.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
Write-Output "Created $OutputPath"
