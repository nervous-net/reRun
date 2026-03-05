# ABOUTME: Windows installer for reRun video rental POS system
# ABOUTME: Installs Node.js, PM2, sets up database, configures auto-start

Write-Host "================================" -ForegroundColor Green
Write-Host "  reRun Video - Installer" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

$InstallDir = "C:\reRun"
$ErrorActionPreference = "Stop"

# Determine the project root (parent of the scripts/ directory this file lives in)
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $PSScriptRoot) {
    # Fallback if PSScriptRoot is empty (e.g. running via paste)
    $ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
}
Write-Host "  Installing from: $ProjectRoot" -ForegroundColor Gray

# Wrap everything in a try/catch so the window stays open on errors
trap {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Red
    Write-Host "  ERROR: Installation failed!" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
    Write-Host "================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Step 1: Check for Node.js
Write-Host "[1/8] Checking for Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version 2>$null
    Write-Host "  Found Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Node.js not found. Downloading installer..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    $nodeMsi = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi
    Write-Host "  Running Node.js installer..." -ForegroundColor Yellow
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$nodeMsi`" /quiet"
    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Write-Host "  Node.js installed." -ForegroundColor Green
}

# Step 2: Install PM2
Write-Host "[2/8] Installing PM2..." -ForegroundColor Cyan
npm install -g pm2 2>$null
Write-Host "  PM2 installed." -ForegroundColor Green

# Step 3: Configure PM2 auto-start
Write-Host "[3/8] Configuring PM2 startup..." -ForegroundColor Cyan
npm install -g pm2-windows-startup 2>$null
pm2-startup install 2>$null
Write-Host "  PM2 startup configured." -ForegroundColor Green

# Step 4: Create install directory and copy files
Write-Host "[4/8] Installing reRun to $InstallDir..." -ForegroundColor Cyan
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}
# Copy everything from project root except the scripts folder
Get-ChildItem -Path $ProjectRoot -Exclude "scripts" | Copy-Item -Destination $InstallDir -Recurse -Force
Write-Host "  Files copied." -ForegroundColor Green

# Step 5: Create data directory
Write-Host "[5/8] Setting up data directory..." -ForegroundColor Cyan
$DataDir = Join-Path $InstallDir "data"
if (!(Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}
Write-Host "  Data directory ready." -ForegroundColor Green

# Step 6: Rebuild native modules for this platform and initialize database
Write-Host "[6/8] Building native modules..." -ForegroundColor Cyan
Set-Location $InstallDir
npm rebuild better-sqlite3
Write-Host "  Ready." -ForegroundColor Green

# Step 7: Start with PM2
Write-Host "[7/8] Starting reRun..." -ForegroundColor Cyan
Set-Location $InstallDir
try { pm2 delete rerun 2>$null } catch { }
pm2 start ecosystem.config.cjs
pm2 save
Write-Host "  reRun is running!" -ForegroundColor Green

# Step 8: Open browser
Write-Host "[8/8] Opening browser..." -ForegroundColor Cyan
Start-Process "http://localhost:1987"

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  reRun installed successfully!" -ForegroundColor Green
Write-Host "  Open http://localhost:1987" -ForegroundColor Green
Write-Host "  reRun will start automatically on boot." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
