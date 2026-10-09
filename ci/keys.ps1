param($text)
$ws = New-Object -ComObject WScript.Shell
$p = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
if (-not $p) { "no chrome window"; exit 1 }
$ok = $ws.AppActivate($p.Id)
Start-Sleep -Milliseconds 800
$ws.SendKeys('^l'); Start-Sleep -Milliseconds 600
$ws.SendKeys($text); Start-Sleep -Milliseconds 1200
$ws.SendKeys('{ENTER}')
"sent activate=$ok title=$($p.MainWindowTitle)"
