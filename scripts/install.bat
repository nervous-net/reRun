@echo off
REM ABOUTME: Windows batch launcher for the PowerShell install script
REM ABOUTME: Handles execution policy so users can double-click to install

echo.
echo ================================
echo   reRun Video - Starting Setup
echo ================================
echo.

REM Launch PowerShell with bypass execution policy for this script only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

REM If PowerShell exits with an error, pause so user can read the message
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ================================
    echo   Something went wrong.
    echo   Please read the messages above.
    echo ================================
    echo.
    pause
)
