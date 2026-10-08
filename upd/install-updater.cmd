@echo off
rem Unchore Browser: turn on automatic update checks for an existing install (no admin needed).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0register.ps1"
if errorlevel 1 (echo Failed & pause & exit /b 1)
echo Unchore Browser automatic update is on.
timeout /t 3 >nul
