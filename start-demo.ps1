param([string]$PreviewOrigin)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$officeNodeCandidates = @(
  (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
)
$officeNodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($officeNodeCommand) { $officeNodeCandidates += $officeNodeCommand.Source }
$officeNodeExecutable = $null
foreach ($officeCandidate in $officeNodeCandidates) {
  if (-not (Test-Path -LiteralPath $officeCandidate)) { continue }
  $officeVersion = & $officeCandidate --version 2>$null
  if ($officeVersion -match '^v(\d+)\.(\d+)\.') {
    if ([int]$Matches[1] -gt 24 -or ([int]$Matches[1] -eq 24 -and [int]$Matches[2] -ge 15)) {
      $officeNodeExecutable = $officeCandidate
      break
    }
  }
}
if (-not $officeNodeExecutable) { throw 'ต้องใช้ Node.js 24.15 ขึ้นไป กรุณาติดตั้ง Node.js แล้วลองอีกครั้ง' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\vite\package.json'))) {
  throw 'ยังไม่ได้ติดตั้งแพ็กเกจ กรุณารัน pnpm install ในโฟลเดอร์นี้ก่อน'
}
$env:Path = (Split-Path -Parent $officeNodeExecutable) + ';' + $env:Path
if ($PreviewOrigin) {
  Write-Host 'Building the protected team preview...' -ForegroundColor Cyan
  & $officeNodeExecutable (Join-Path $PSScriptRoot 'node_modules\typescript\bin\tsc') --noEmit
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $officeNodeExecutable (Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js') build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & $officeNodeExecutable (Join-Path $PSScriptRoot 'scripts\start-tunnel-preview.mjs') $PreviewOrigin
  exit $LASTEXITCODE
}
Write-Host ''
Write-Host 'Assemble · Local demo' -ForegroundColor Green
Write-Host 'เปิด http://localhost:4173 ในเบราว์เซอร์' -ForegroundColor Green
Write-Host 'กด Ctrl+C เพื่อหยุดเซิร์ฟเวอร์'
Write-Host ''
& $officeNodeExecutable --watch --watch-path (Join-Path $PSScriptRoot 'server') --watch-path (Join-Path $PSScriptRoot 'shared') (Join-Path $PSScriptRoot 'server\index.mjs')
exit $LASTEXITCODE
