param($path)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=[System.Windows.Automation.Condition]::TrueCondition
$dlg=$null
for($i=0;$i -lt 20 -and -not $dlg;$i++){
  foreach($w in $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770')))){ $dlg=$w; break }
  if(-not $dlg){ Start-Sleep -Milliseconds 500 }
}
if(-not $dlg){ "no dialog"; exit 1 }
$out="dialog=" + $dlg.Current.Name
$edits=$dlg.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)))
$set=$false
foreach($e in $edits){ $n=$e.Current.Name; $out += " edit[$n]"; if(-not $set -and ($n -match '폴더|Folder')){ try { $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($path); $set=$true; $out+=" set" } catch { $out+=" seterr" } } }
if(-not $set -and $edits.Count -gt 0){ try { $edits[$edits.Count-1].GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($path); $set=$true; $out+=" set-last" } catch {} }
Start-Sleep -Milliseconds 800
$btns=$dlg.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)))
$done=$false
foreach($bt in $btns){ $n=$bt.Current.Name; if(-not $done -and ($n -match '폴더 선택|Select Folder')){ try { $bt.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); $done=$true; $out+=" invoked[$n]" } catch { $out+=" invokeerr" } } }
if(-not $done){ $ws=New-Object -ComObject WScript.Shell; $ws.SendKeys('{ENTER}'); $out+=" enter" }
Start-Sleep -Milliseconds 2500
$still=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770')))
if($still.Count -gt 0){ $ws=New-Object -ComObject WScript.Shell; $ws.SendKeys('{ENTER}'); Start-Sleep -Milliseconds 1500; $out+=" enter2" }
$out
