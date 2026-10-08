# Unchore Browser 자동 업데이트 확인 (2026-10-09). 작업 스케줄러가 하루 1번·로그인 때 부른다.
# 버전 정보(JSON: version, url, sha256)를 읽고 새 판이면 받아서 sha256을 맞춘 뒤 조용히 덮어 설치한다.
# 브라우저가 켜져 있으면 설치 프로그램이 new_chrome.exe 로 두고, 다음 시작 때 크로미움이 스스로 바꿔 끼운다.
param([string]$Manifest = 'https://github.com/smilemino/unchore-browser-releases/releases/latest/download/latest.json',
      [switch]$Force)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$Base = Join-Path $env:LOCALAPPDATA 'Unchore Browser'
$App = Join-Path $Base 'Application'
$Dir = Join-Path $Base 'Updater'
New-Item -ItemType Directory -Force $Dir | Out-Null
$Log = Join-Path $Dir 'update.log'
function L([string]$m) { "$(Get-Date -Format s) $m" | Add-Content -Encoding utf8 $Log; Write-Output $m }
# 받는 곳 제한: 회사 깃허브 주소에서만 받는다(버전 정보가 바뀌어도 남의 파일을 깔지 않게)
$Allowed = @('https://github.com/smilemino/', 'https://objects.githubusercontent.com/', 'https://release-assets.githubusercontent.com/')
$cfg = Join-Path $Dir 'manifest-url.txt'
if (Test-Path $cfg) { $Manifest = (Get-Content $cfg -Raw).Trim() }
function Cur {
  if (-not (Test-Path $App)) { return $null }
  Get-ChildItem $App -Directory | Where-Object Name -match '^\d+\.\d+\.\d+\.\d+$' |
    ForEach-Object { [version]$_.Name } | Sort-Object -Descending | Select-Object -First 1
}
# 하루에 여러 번 겹쳐 돌지 않게
$lock = Join-Path $Dir 'update.lock'
if ((Test-Path $lock) -and ((Get-Date) - (Get-Item $lock).LastWriteTime).TotalMinutes -lt 60) { L 'skip: another check running'; exit 0 }
Set-Content $lock $PID
try {
  $cur = Cur
  if (-not $cur) { L 'not installed'; exit 3 }
  $j = Invoke-RestMethod -Uri $Manifest -TimeoutSec 60 -Headers @{ 'Cache-Control' = 'no-cache' }
  $new = [version]$j.version
  if ($new -le $cur -and -not $Force) { L "up to date: installed $cur, latest $new"; exit 0 }
  if (-not ($Allowed | Where-Object { $j.url.StartsWith($_) })) { L "refuse url: $($j.url)"; exit 5 }
  if ($j.sha256 -notmatch '^[0-9a-fA-F]{64}$') { L 'refuse: bad sha256 in manifest'; exit 5 }
  $tmp = Join-Path $env:TEMP "unchore-setup-$new.exe"
  L "download $new from $($j.url)"
  Invoke-WebRequest -Uri $j.url -OutFile $tmp -TimeoutSec 1800 -UseBasicParsing
  $h = (Get-FileHash $tmp -Algorithm SHA256).Hash
  if ($h -ne $j.sha256.ToUpper()) { L "sha256 mismatch: got $h"; Remove-Item -Force $tmp; exit 4 }
  $running = [bool](Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$App\*" })
  $p = Start-Process $tmp -ArgumentList '--do-not-launch-chrome' -Wait -PassThru -WindowStyle Hidden
  Remove-Item -Force $tmp -ErrorAction SilentlyContinue
  $after = Cur
  $pending = Test-Path (Join-Path $App 'new_chrome.exe')
  L "installed: rc=$($p.ExitCode) before=$cur after=$after browser_running=$running new_chrome_pending=$pending"
  exit 0
} catch { L "error: $($_.Exception.Message)"; exit 1 }
finally { Remove-Item -Force $lock -ErrorAction SilentlyContinue }
