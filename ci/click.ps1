param($name)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=[System.Windows.Automation.Condition]::TrueCondition
$procs = @(Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object Id)
$bc=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)
foreach($w in $root.FindAll([System.Windows.Automation.TreeScope]::Children,$cond)){
  if(-not ($procs -contains $w.Current.ProcessId)){ continue }
  foreach($b in $w.FindAll([System.Windows.Automation.TreeScope]::Descendants,$bc)){
    if($b.Current.Name -eq $name){
      try { $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); "clicked[$name]"; exit 0 } catch { "invokeerr $_"; exit 1 }
    }
  }
}
"no button[$name]"
