// ABOUTME: Service for checking GitHub releases for app updates
// ABOUTME: Polls periodically, compares semver, caches update status in memory

const GITHUB_REPO = 'nervous-net/reRun';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  tagName: string;
}

interface UpdateStatus {
  currentVersion: string;
  availableUpdate: UpdateInfo | null;
  lastChecked: string | null;
  updating: boolean;
}

let cachedStatus: UpdateStatus = {
  currentVersion: '',
  availableUpdate: null,
  lastChecked: null,
  updating: false,
};

let checkTimer: ReturnType<typeof setInterval> | null = null;

export function isNewerVersion(current: string, remote: string): boolean {
  const clean = (v: string) => v.replace(/^v/, '');
  const [cMajor, cMinor, cPatch] = clean(current).split('.').map(Number);
  const [rMajor, rMinor, rPatch] = clean(remote).split('.').map(Number);

  if (rMajor !== cMajor) return rMajor > cMajor;
  if (rMinor !== cMinor) return rMinor > cMinor;
  return rPatch > cPatch;
}

export function parseGitHubRelease(release: any): UpdateInfo | null {
  const tag = release.tag_name;
  const zipAsset = release.assets?.find((a: any) => a.name.endsWith('.zip'));
  if (!zipAsset) return null;

  return {
    version: tag.replace(/^v/, ''),
    downloadUrl: zipAsset.browser_download_url,
    tagName: tag,
  };
}

export async function checkForUpdates(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'reRun-updater' },
    });
    if (!res.ok) {
      console.warn(`[UPDATE] GitHub API returned ${res.status} for ${url}`);
      return null;
    }

    const release = await res.json();
    const info = parseGitHubRelease(release);
    if (!info) {
      console.warn('[UPDATE] No .zip asset found in latest release');
      return null;
    }

    console.log(`[UPDATE] Current: v${currentVersion}, Latest: v${info.version}, Update available: ${isNewerVersion(currentVersion, info.version)}`);
    return isNewerVersion(currentVersion, info.version) ? info : null;
  } catch (err) {
    console.warn('[UPDATE] Failed to check for updates:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function forceCheck(): Promise<UpdateStatus> {
  if (!cachedStatus.currentVersion) {
    return { ...cachedStatus };
  }
  const update = await checkForUpdates(cachedStatus.currentVersion);
  cachedStatus.availableUpdate = update;
  cachedStatus.lastChecked = new Date().toISOString();
  return { ...cachedStatus };
}

export function getUpdateStatus(): UpdateStatus {
  return { ...cachedStatus };
}

export function setUpdating(updating: boolean): void {
  cachedStatus.updating = updating;
}

export function startUpdateChecker(currentVersion: string): void {
  cachedStatus.currentVersion = currentVersion;

  async function check() {
    const update = await checkForUpdates(currentVersion);
    cachedStatus.availableUpdate = update;
    cachedStatus.lastChecked = new Date().toISOString();
  }

  // Check immediately on startup
  check();

  // Then check every 6 hours
  checkTimer = setInterval(check, CHECK_INTERVAL_MS);
}

export function stopUpdateChecker(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}
