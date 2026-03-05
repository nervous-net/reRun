#!/bin/bash
# ABOUTME: Packages a reRun release for distribution via GitHub releases
# ABOUTME: Builds the app, bundles dist + node_modules + drizzle + config into a zip

set -e

VERSION=$(node -p "require('./package.json').version")
echo "Packaging reRun v${VERSION}..."

# Clean build
rm -rf dist
npm run build

# Create release directory
RELEASE_DIR="rerun-v${VERSION}"
rm -rf "$RELEASE_DIR" "rerun-v${VERSION}.zip"
mkdir -p "$RELEASE_DIR"

# Copy release files
cp -r dist "$RELEASE_DIR/"
cp -r node_modules "$RELEASE_DIR/"
cp -r drizzle "$RELEASE_DIR/"
cp package.json "$RELEASE_DIR/"
cp ecosystem.config.cjs "$RELEASE_DIR/"
cp -r scripts "$RELEASE_DIR/"

# Create zip
zip -r "rerun-v${VERSION}.zip" "$RELEASE_DIR"
rm -rf "$RELEASE_DIR"

echo "Created rerun-v${VERSION}.zip"
echo "Upload this to GitHub releases with tag v${VERSION}"
