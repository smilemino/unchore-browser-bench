param($name)
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=[System.Windows.Automation.Condition]::TrueCondition
$procs = @(Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object Id)
$out=@()
$wins=$root.FindAll([System.Windows.Automation.TreeScope]::Children,$cond)
foreach($w in $wins){
  try {
    if($procs -contains $w.Current.ProcessId){
      $out += "WIN: " + $w.Current.Name + " [" + $w.Current.ClassName + "]"
      $all=$w.FindAll([System.Windows.Automation.TreeScope]::Descendants,$cond)
      $n=0
      foreach($e in $all){
        if($n -ge 300){ break }
        $nm=$e.Current.Name
        if($nm){ $ct=$e.Current.ControlType.ProgrammaticName -replace 'ControlType\.',''; $out += "  " + $ct + ": " + $nm; $n++ }
      }
    }
  } catch { $out += "ERR $_" }
}
$out | Out-File -Encoding utf8 "C:\out\uia_$name.txt"
"windows=" + (($out | Where-Object { $_ -like 'WIN:*' }) -join ' || ')
