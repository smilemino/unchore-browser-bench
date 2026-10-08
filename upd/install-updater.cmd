@echo off
rem Unchore Browser: turn on automatic update checks for an existing install (no admin needed).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0register.ps1"
if errorlevel 1 (echo Failed & pause & exit /b 1)
echo Unchore Browser automatic update is on.
rem wait 3 seconds so a double-clicked window can be read (timeout.exe fails without a console)
ping -n 4 127.0.0.1 >nul
exit /b 0
