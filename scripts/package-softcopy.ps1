# Copy AttendPro desktop installer into a softcopy folder for lecturers.
# Does NOT copy secrets (.env.local).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "dist\desktop\AttendPro-Setup-1.0.0.exe"
$outDir = Join-Path $root "softcopy"
$guide = Join-Path $root "DESKTOP_SUBMISSION.md"

if (-not (Test-Path $exe)) {
  Write-Error "Installer not found. Run: npm run desktop:build"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Copy-Item $exe -Destination (Join-Path $outDir "AttendPro-Setup-1.0.0.exe") -Force
Copy-Item $guide -Destination (Join-Path $outDir "DESKTOP_SUBMISSION.md") -Force

$zip = Join-Path $root "AttendPro-Softcopy.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $outDir "*") -DestinationPath $zip -Force

Write-Host "Softcopy folder: $outDir"
Write-Host "Softcopy ZIP:    $zip"
Get-ChildItem $zip | Format-List FullName, Length
