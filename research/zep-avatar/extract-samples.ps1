Add-Type -AssemblyName System.Drawing
$sampleDir = Join-Path $PSScriptRoot 'samples'
$frameDir = Join-Path $sampleDir 'frames'
New-Item -ItemType Directory -Force -Path $frameDir | Out-Null
$sheet = [Drawing.Image]::FromFile((Join-Path $sampleDir 'avatar-12-33-66-178.png'))
for ($i = 0; $i -lt 36; $i++) {
    $frame = [Drawing.Bitmap]::new(48,64)
    $graphics = [Drawing.Graphics]::FromImage($frame)
    $source = [Drawing.Rectangle]::new(($i % 9)*48,[int][Math]::Floor($i/9)*64,48,64)
    $graphics.DrawImage($sheet,[Drawing.Rectangle]::new(0,0,48,64),$source,[Drawing.GraphicsUnit]::Pixel)
    $frame.Save((Join-Path $frameDir ('frame-{0:D2}.png' -f $i)),[Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $frame.Dispose()
}
$sheet.Dispose()
$combined = [Drawing.Bitmap]::new(432,256)
$graphics = [Drawing.Graphics]::FromImage($combined)
foreach ($name in @('skin--2.png','face--69.png','clothes--776.png','hair--745.png')) {
    $layer = [Drawing.Image]::FromFile((Join-Path $sampleDir $name))
    $graphics.DrawImageUnscaled($layer,0,0)
    $layer.Dispose()
}
$combined.Save((Join-Path $sampleDir 'composed-example.png'),[Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$combined.Dispose()
$preview = [Drawing.Bitmap]::new(864,512)
$graphics = [Drawing.Graphics]::FromImage($preview)
$graphics.Clear([Drawing.Color]::FromArgb(232,236,244))
$graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::Half
$sheet = [Drawing.Image]::FromFile((Join-Path $sampleDir 'avatar-12-33-66-178.png'))
$graphics.DrawImage($sheet,0,0,864,512)
$preview.Save((Join-Path $sampleDir 'preview.png'),[Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
$graphics.Dispose()
$preview.Dispose()
$bundle = Join-Path $PSScriptRoot 'shipped/876.be6f659a7165c94e.js'
$sourceText = [IO.File]::ReadAllText($bundle)
$snippets = foreach ($term in @('class lh','class lm','this.avatarType="nft"','down_jump:{frames:[28]')) {
    $offset = $sourceText.IndexOf($term)
    [pscustomobject]@{ term=$term; characterOffset=$offset; text=$sourceText.Substring([Math]::Max(0,$offset-100),[Math]::Min(5000,$sourceText.Length-[Math]::Max(0,$offset-100))) }
}
$snippets | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'source-excerpts.json')
Get-ChildItem $sampleDir -Filter *.png | Get-FileHash -Algorithm SHA256 | Select-Object Path,Hash | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'sample-hashes.json')
