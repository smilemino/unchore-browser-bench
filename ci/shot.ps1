param($name)
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
try {
  $r=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bm=New-Object System.Drawing.Bitmap $r.Width,$r.Height
  [System.Drawing.Graphics]::FromImage($bm).CopyFromScreen($r.Location,[System.Drawing.Point]::Empty,$r.Size)
  $bm.Save("C:\out\$name.png")
  "shot ok $($r.Width)x$($r.Height)"
} catch { "shot fail $_" }
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | ForEach-Object { "title: " + $_.MainWindowTitle }
