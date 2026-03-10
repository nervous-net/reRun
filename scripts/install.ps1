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

# Wrap everything in a trap so the window stays open on errors
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

# Helper: find npm.cmd by searching known locations and PATH
# Returns the full path to npm.cmd, or throws with manual install instructions
function Find-Npm {
    # Check known Node.js install locations
    $candidates = @(
        "$env:ProgramFiles\nodejs\npm.cmd",
        "${env:ProgramFiles(x86)}\nodejs\npm.cmd",
        "$env:APPDATA\npm\npm.cmd",
        "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    # Check PATH as last resort
    $fromPath = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }
    $fromPath = Get-Command npm -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }
    return $null
}

# Helper: find node.exe by searching known locations and PATH
function Find-Node {
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    $fromPath = Get-Command node -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }
    return $null
}

# Step 1: Check for Node.js
Write-Host "[1/8] Checking for Node.js..." -ForegroundColor Cyan
$nodePath = Find-Node
if ($nodePath) {
    $nodeVersion = & $nodePath --version 2>$null
    Write-Host "  Found Node.js $nodeVersion at $nodePath" -ForegroundColor Green
} else {
    Write-Host "  Node.js not found. Downloading installer..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    $nodeMsi = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi
    Write-Host "  Running Node.js installer..." -ForegroundColor Yellow
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$nodeMsi`" /quiet"
    # Re-check after install
    $nodePath = Find-Node
    if (-not $nodePath) {
        Write-Host ""
        Write-Host "  Node.js was installed but could not be found." -ForegroundColor Red
        Write-Host ""
        Write-Host "  MANUAL FIX:" -ForegroundColor Yellow
        Write-Host "  1. Go to https://nodejs.org" -ForegroundColor White
        Write-Host "  2. Download and run the LTS installer (use all defaults)" -ForegroundColor White
        Write-Host "  3. RESTART your computer" -ForegroundColor White
        Write-Host "  4. Double-click install.bat again" -ForegroundColor White
        Write-Host ""
        throw "Node.js not found after install. See manual steps above."
    }
    Write-Host "  Node.js installed at $nodePath" -ForegroundColor Green
}

# Find npm.cmd (use .cmd explicitly to avoid PowerShell execution policy issues with npm.ps1)
$npmPath = Find-Npm
if (-not $npmPath) {
    Write-Host ""
    Write-Host "  npm was not found on this system." -ForegroundColor Red
    Write-Host ""
    Write-Host "  MANUAL FIX:" -ForegroundColor Yellow
    Write-Host "  1. Go to https://nodejs.org" -ForegroundColor White
    Write-Host "  2. Download and run the LTS installer (use all defaults)" -ForegroundColor White
    Write-Host "  3. RESTART your computer" -ForegroundColor White
    Write-Host "  4. Double-click install.bat again" -ForegroundColor White
    Write-Host ""
    throw "npm not found. See manual steps above."
}
Write-Host "  Using npm at $npmPath" -ForegroundColor Gray

# Step 2: Install PM2
Write-Host "[2/8] Installing PM2..." -ForegroundColor Cyan
& $npmPath install -g pm2 2>$null
Write-Host "  PM2 installed." -ForegroundColor Green

# Step 3: Configure PM2 auto-start
Write-Host "[3/8] Configuring PM2 startup..." -ForegroundColor Cyan
& $npmPath install -g pm2-windows-startup 2>$null
try { pm2-startup install 2>$null } catch { }
Write-Host "  PM2 startup configured." -ForegroundColor Green

# Step 4: Stop existing reRun process (if running) before copying files
Write-Host "[4/8] Installing reRun to $InstallDir..." -ForegroundColor Cyan
try { pm2 stop rerun 2>$null } catch { }
try { pm2 delete rerun 2>$null } catch { }
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

# Step 6: Install/rebuild native modules for this platform
Write-Host "[6/8] Building native modules..." -ForegroundColor Cyan
Set-Location $InstallDir
# Use npm install (not rebuild) to properly fetch prebuilt binaries
& $npmPath install better-sqlite3 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  better-sqlite3 failed to build." -ForegroundColor Red
    Write-Host ""
    Write-Host "  MANUAL FIX:" -ForegroundColor Yellow
    Write-Host "  1. Open PowerShell as Administrator" -ForegroundColor White
    Write-Host "  2. Run: npm install -g windows-build-tools" -ForegroundColor White
    Write-Host "  3. Close all terminals, then double-click install.bat again" -ForegroundColor White
    Write-Host ""
    throw "Native module build failed. See manual steps above."
}
Write-Host "  Ready." -ForegroundColor Green

# Step 7: Start with PM2
Write-Host "[7/8] Starting reRun..." -ForegroundColor Cyan
Set-Location $InstallDir
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
