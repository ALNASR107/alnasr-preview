# بديل بدون تنزيل أي أداة: تشغيل الموقع تلقائيًا عند إقلاع ويندوز عبر Task Scheduler
# الاستخدام: انقر يمين على الملف ← Run with PowerShell (كمسؤول)
#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot        # مجلد المشروع
$node    = (Get-Command node.exe).Source
$nextBin = Join-Path $root 'node_modules\next\dist\bin\next'
$taskName = 'AlNasrOps'

if (-not (Test-Path $nextBin)) {
  Write-Host 'لم أجد نسخة التشغيل. شغّل START-WINDOWS.bat مرة واحدة أولًا (يثبّت ويبني).' -ForegroundColor Yellow
  exit 1
}

$action = New-ScheduledTaskAction -Execute $node `
  -Argument "`"$nextBin`" start -H 0.0.0.0 -p 3000" -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 0)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'شركة النصر — العمليات المالية + واتساب' -RunLevel Highest -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "`n✔ تم إنشاء المهمة '$taskName' وتشغيلها. تعمل تلقائيًا عند كل إقلاع." -ForegroundColor Green
Write-Host "الموقع: http://localhost:3000" -ForegroundColor Cyan
Write-Host "لإزالتها:  Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false" -ForegroundColor Gray
