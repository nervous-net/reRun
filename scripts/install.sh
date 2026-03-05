#!/bin/bash
# ABOUTME: Mac/Linux installer for reRun video rental POS system
# ABOUTME: Installs Node.js (if needed), PM2, sets up database, configures auto-start

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="$HOME/rerun"

# Determine the project root (parent of the scripts/ directory this file lives in)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  reRun Video - Installer${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Step 1: Check for Node.js
echo -e "${CYAN}[1/8] Checking for Node.js...${NC}"
if command -v node &> /dev/null; then
    echo -e "  Found Node.js $(node --version)"
else
    echo -e "${YELLOW}  Node.js not found.${NC}"
    echo "  Please install Node.js first:"
    echo "    macOS: brew install node"
    echo "    Linux: https://nodejs.org/en/download/"
    exit 1
fi

# Step 2: Install PM2
echo -e "${CYAN}[2/8] Installing PM2...${NC}"
npm install -g pm2 2>/dev/null
echo -e "  PM2 installed."

# Step 3: Configure PM2 startup
echo -e "${CYAN}[3/8] Configuring PM2 startup...${NC}"
pm2 startup 2>/dev/null || true
echo -e "  PM2 startup configured."

# Step 4: Install reRun
echo -e "${CYAN}[4/8] Installing reRun to $INSTALL_DIR...${NC}"
mkdir -p "$INSTALL_DIR"
# Copy everything from project root except the scripts folder
rsync -a --exclude='scripts' "$PROJECT_ROOT/" "$INSTALL_DIR/"
echo -e "  Files copied."

# Step 5: Create data directory
echo -e "${CYAN}[5/8] Setting up data directory...${NC}"
mkdir -p "$INSTALL_DIR/data"
echo -e "  Data directory ready."

# Step 6: Database will be initialized automatically on first server start
echo -e "${CYAN}[6/8] Database will initialize on first start...${NC}"
cd "$INSTALL_DIR"
echo -e "  Ready."

# Step 7: Start with PM2
echo -e "${CYAN}[7/8] Starting reRun...${NC}"
pm2 delete rerun 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
echo -e "  reRun is running!"

# Step 8: Open browser
echo -e "${CYAN}[8/8] Opening browser...${NC}"
if command -v open &> /dev/null; then
    open "http://localhost:1987"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:1987"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  reRun installed successfully!${NC}"
echo -e "${GREEN}  Open http://localhost:1987${NC}"
echo -e "${GREEN}  reRun will start automatically on boot.${NC}"
echo -e "${GREEN}================================${NC}"
