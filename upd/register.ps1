# Unchore Browser 업데이트 확인을 «작업 스케줄러»에 등록한다(관리자 권한 없이, 지금 사용자 몫).
# 브라우저 설치 폴더 안(<판>\Updater)에서 브라우저가 처음 켜질 때 부르고, .99 사용자는 install-updater.cmd 로 부른다.
param([string]$Manifest = '')
$ErrorActionPreference = 'Stop'
$Dir = Join-Path $env:LOCALAPPDATA 'Unchore Browser\Updater'
New-Item -ItemType Directory -Force $Dir | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot 'unchore-update.ps1') $Dir
if ($Manifest) { Set-Content -Encoding ascii (Join-Path $Dir 'manifest-url.txt') $Manifest }
$ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$act = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dir\unchore-update.ps1`""
$daily = New-ScheduledTaskTrigger -Daily -At '12:00'
$daily.RandomDelay = 'PT2H'
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$name = 'Unchore Browser Update'
$mode = 'daily+logon'
try {
  $logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $logon.Delay = 'PT5M'
  Register-ScheduledTask -TaskName $name -Action $act -Trigger @($daily, $logon) -Settings $set -Force | Out-Null
} catch {
  # 관리자 아닌 계정에서 «로그인 때» 조건이 막히면 «하루 1번»만 건다(놓친 날은 켜질 때 바로 돈다: StartWhenAvailable)
  $mode = 'daily'
  Register-ScheduledTask -TaskName $name -Action $act -Trigger $daily -Settings $set -Force | Out-Null
}
$ver = Split-Path -Leaf (Split-Path -Parent $PSScriptRoot)
Set-Content -Encoding ascii (Join-Path $Dir 'registered.txt') "$ver $mode $(Get-Date -Format s)"
Write-Output "REGISTERED $name $mode"
