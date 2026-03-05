// ABOUTME: Standalone update script that downloads and installs new reRun versions
// ABOUTME: Runs detached from the server process — backs up DB, replaces files, restarts PM2

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';

// Parse args
const args = process.argv.slice(2);
function getArg(name: string): string {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length)
    throw new Error(`Missing arg: ${name}`);
  return args[idx + 1];
}

const version = getArg('--version');
const url = getArg('--url');
const dbPath = getArg('--db-path');
const backupDir = getArg('--backup-dir');
const appDir = process.cwd();
const logFile = path.join(path.dirname(dbPath), 'update.log');

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

async function main() {
  try {
    log(`Starting update to ${version}`);

    // 1. Pre-update backup
    log('Creating pre-update backup...');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupName = `pre-update-${version}.db`;
    fs.copyFileSync(dbPath, path.join(backupDir, backupName));
    log(`Backup created: ${backupName}`);

    // 2. Download release zip
    const tmpDir = path.join(appDir, '.update-tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, 'release.zip');
    log(`Downloading ${url}...`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
    await pipeline(
      Readable.fromWeb(res.body as any),
      createWriteStream(zipPath)
    );
    log('Download complete');

    // 3. Extract zip
    log('Extracting...');
    if (process.platform === 'win32') {
      execSync(
        `powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${tmpDir}/extracted'"`,
        { stdio: 'pipe' }
      );
    } else {
      execSync(`unzip -o "${zipPath}" -d "${tmpDir}/extracted"`, {
        stdio: 'pipe',
      });
    }

    // Find the extracted root (might be nested in a folder)
    const extractedDir = path.join(tmpDir, 'extracted');
    let sourceDir = extractedDir;
    const entries = fs.readdirSync(extractedDir);
    if (
      entries.length === 1 &&
      fs.statSync(path.join(extractedDir, entries[0])).isDirectory()
    ) {
      sourceDir = path.join(extractedDir, entries[0]);
    }

    // 4. Replace dist/
    log('Replacing dist/...');
    const distSource = path.join(sourceDir, 'dist');
    const distTarget = path.join(appDir, 'dist');
    if (fs.existsSync(distSource)) {
      if (fs.existsSync(distTarget)) fs.rmSync(distTarget, { recursive: true });
      fs.cpSync(distSource, distTarget, { recursive: true });
    }

    // 5. Replace node_modules/ if included
    const nmSource = path.join(sourceDir, 'node_modules');
    const nmTarget = path.join(appDir, 'node_modules');
    if (fs.existsSync(nmSource)) {
      log('Replacing node_modules/...');
      if (fs.existsSync(nmTarget)) fs.rmSync(nmTarget, { recursive: true });
      fs.cpSync(nmSource, nmTarget, { recursive: true });
    }

    // 6. Copy new package.json
    const pkgSource = path.join(sourceDir, 'package.json');
    if (fs.existsSync(pkgSource)) {
      fs.copyFileSync(pkgSource, path.join(appDir, 'package.json'));
    }

    // 7. Copy drizzle migrations
    const drizzleSource = path.join(sourceDir, 'drizzle');
    const drizzleTarget = path.join(appDir, 'drizzle');
    if (fs.existsSync(drizzleSource)) {
      log('Copying migrations...');
      fs.cpSync(drizzleSource, drizzleTarget, { recursive: true });
    }

    // 8. Migrations run automatically on server startup — no drizzle-kit needed

    // 9. Cleanup temp
    fs.rmSync(tmpDir, { recursive: true });

    // 10. Restart via PM2
    log('Restarting app...');
    execSync('npx pm2 restart rerun', { cwd: appDir, stdio: 'pipe' });

    log(`Update to ${version} complete!`);
  } catch (err: any) {
    log(`UPDATE FAILED: ${err.message}`);
    process.exit(1);
  }
}

main();
