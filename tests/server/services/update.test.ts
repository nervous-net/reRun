// ABOUTME: Tests for the update check service
// ABOUTME: Validates version comparison and update status logic

import { describe, it, expect } from 'vitest';
import { isNewerVersion, parseGitHubRelease, readLastError } from '../../../server/services/update.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('isNewerVersion', () => {
  it('detects newer major version', () => {
    expect(isNewerVersion('0.1.0', '1.0.0')).toBe(true);
  });

  it('detects newer minor version', () => {
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(true);
  });

  it('detects newer patch version', () => {
    expect(isNewerVersion('0.1.0', '0.1.1')).toBe(true);
  });

  it('returns false for same version', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
  });

  it('returns false for older version', () => {
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(false);
  });

  it('handles v prefix in remote version', () => {
    expect(isNewerVersion('0.1.0', 'v0.2.0')).toBe(true);
  });
});

describe('parseGitHubRelease', () => {
  it('extracts version and download URL from release data', () => {
    const release = {
      tag_name: 'v0.2.0',
      assets: [
        { name: 'rerun-v0.2.0.zip', browser_download_url: 'https://example.com/rerun-v0.2.0.zip' },
      ],
    };
    const result = parseGitHubRelease(release);
    expect(result).toEqual({
      version: '0.2.0',
      downloadUrl: 'https://example.com/rerun-v0.2.0.zip',
      tagName: 'v0.2.0',
    });
  });

  it('returns null when no zip asset found', () => {
    const release = { tag_name: 'v0.2.0', assets: [] };
    expect(parseGitHubRelease(release)).toBeNull();
  });
});

describe('forceCheck', () => {
  it('is exported as a function', async () => {
    const { forceCheck } = await import('../../../server/services/update.js');
    expect(typeof forceCheck).toBe('function');
  });
});

describe('readLastError', () => {
  it('returns null when log file does not exist', () => {
    expect(readLastError('/nonexistent/update.log')).toBeNull();
  });

  it('returns error message when last line contains UPDATE FAILED', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
    const logPath = path.join(tmpDir, 'update.log');
    fs.writeFileSync(logPath, [
      '[2026-03-12T10:00:00.000Z] Starting update to v0.3.8',
      '[2026-03-12T10:00:05.000Z] UPDATE FAILED: Download failed: 404',
    ].join('\n'));
    expect(readLastError(logPath)).toBe('UPDATE FAILED: Download failed: 404');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns null when last line is a success message', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
    const logPath = path.join(tmpDir, 'update.log');
    fs.writeFileSync(logPath, [
      '[2026-03-12T10:00:00.000Z] Starting update to v0.3.8',
      '[2026-03-12T10:00:30.000Z] Update to v0.3.8 complete!',
    ].join('\n'));
    expect(readLastError(logPath)).toBeNull();
    fs.rmSync(tmpDir, { recursive: true });
  });
});
