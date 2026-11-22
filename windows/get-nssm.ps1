# تنزيل أداة NSSM ونسخها إلى مجلد tools داخل المشروع
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root 'tools'
New-Item -ItemType Directory -Force -Path $tools | Out-Null

$zip = Join-Path $env:TEMP 'nssm.zip'
$dir = Join-Path $env:TEMP 'nssm_extract'

Write-Host 'تنزيل NSSM...'
Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zip -UseBasicParsing

if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $dir -Force

$exe = Get-ChildItem -Path $dir -Recurse -Filter nssm.exe |
       Where-Object { $_.FullName -like '*win64*' } | Select-Object -First 1
if (-not $exe) { $exe = Get-ChildItem -Path $dir -Recurse -Filter nssm.exe | Select-Object -First 1 }

Copy-Item $exe.FullName (Join-Path $tools 'nssm.exe') -Force
Write-Host "تم النسخ إلى: $tools\nssm.exe"
