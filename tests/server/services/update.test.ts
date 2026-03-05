// ABOUTME: Tests for the update check service
// ABOUTME: Validates version comparison and update status logic

import { describe, it, expect } from 'vitest';
import { isNewerVersion, parseGitHubRelease } from '../../../server/services/update.js';

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
