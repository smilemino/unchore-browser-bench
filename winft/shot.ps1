param([string]$out)
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$r=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bm=New-Object System.Drawing.Bitmap $r.Width,$r.Height
[System.Drawing.Graphics]::FromImage($bm).CopyFromScreen($r.Location,[System.Drawing.Point]::Empty,$r.Size)
$bm.Save($out)
