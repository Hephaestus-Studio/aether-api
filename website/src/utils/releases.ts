export const GITHUB_REPO = "https://github.com/Hephaestus-Studio/aether-api";

export interface ReleaseAssetLinks {
  appImage: string;
  deb: string;
  rpm: string;
  sha256: string;
}

export interface ReleaseChannelInfo {
  tag: string;
  rawVersion: string;
  name?: string;
  publishedAt?: string;
  htmlUrl: string;
  isPrerelease: boolean;
  assets: ReleaseAssetLinks;
}

export interface ReleasesData {
  stable: ReleaseChannelInfo;
  beta: ReleaseChannelInfo | null;
  hasBetaNewer: boolean;
}

export const DEFAULT_STABLE_TAG = "v0.2.0";
export const DEFAULT_STABLE_RAW = "0.2.0";

export function getDownloadUrls(tag: string, rawVersion: string): ReleaseAssetLinks {
  const base = `${GITHUB_REPO}/releases/download/${tag}`;
  return {
    appImage: `${base}/Aether.API_${rawVersion}_amd64.AppImage`,
    deb: `${base}/Aether.API_${rawVersion}_amd64.deb`,
    rpm: `${base}/Aether.API-${rawVersion}-1.x86_64.rpm`,
    sha256: `${base}/SHA256SUMS`,
  };
}

export const DEFAULT_STABLE_RELEASE: ReleaseChannelInfo = {
  tag: DEFAULT_STABLE_TAG,
  rawVersion: DEFAULT_STABLE_RAW,
  name: `Aether API ${DEFAULT_STABLE_TAG}`,
  htmlUrl: `${GITHUB_REPO}/releases/tag/${DEFAULT_STABLE_TAG}`,
  isPrerelease: false,
  assets: getDownloadUrls(DEFAULT_STABLE_TAG, DEFAULT_STABLE_RAW),
};

export interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
  prereleaseParts: (string | number)[];
}

export function parseSemVer(versionStr: string): ParsedSemVer | null {
  const cleaned = versionStr.trim().replace(/^v/i, "");
  // Regex to extract major.minor.patch and optional -prerelease
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const prerelease = match[4] || null;

  const prereleaseParts = prerelease
    ? prerelease.split(".").map((part) => {
        const num = Number(part);
        return isNaN(num) ? part.toLowerCase() : num;
      })
    : [];

  return { major, minor, patch, prerelease, prereleaseParts };
}

/**
 * Compares two semantic version strings.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemVer(v1: string, v2: string): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  if (!p1 && !p2) return 0;
  if (!p1) return -1;
  if (!p2) return 1;

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  // If major.minor.patch are identical:
  // Version without prerelease is HIGHER than version with prerelease (e.g. 0.2.0 > 0.2.0-beta.1)
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && !p2.prerelease) return -1;
  if (!p1.prerelease && !p2.prerelease) return 0;

  // Compare prerelease segments
  const len = Math.max(p1.prereleaseParts.length, p2.prereleaseParts.length);
  for (let i = 0; i < len; i++) {
    const part1 = p1.prereleaseParts[i];
    const part2 = p2.prereleaseParts[i];

    if (part1 === undefined) return -1;
    if (part2 === undefined) return 1;

    if (typeof part1 === "number" && typeof part2 === "number") {
      if (part1 !== part2) return part1 > part2 ? 1 : -1;
    } else if (typeof part1 === "string" && typeof part2 === "string") {
      if (part1 !== part2) return part1.localeCompare(part2) > 0 ? 1 : -1;
    } else {
      // Numeric identifiers always have lower precedence than string identifiers
      return typeof part1 === "number" ? -1 : 1;
    }
  }

  return 0;
}

interface GitHubReleaseApiItem {
  tag_name: string;
  name?: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string;
  html_url: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export function formatReleaseItem(item: GitHubReleaseApiItem): ReleaseChannelInfo {
  const tag = item.tag_name;
  const rawVersion = tag.replace(/^v/i, "");

  // Standard direct links fallback
  const directUrls = getDownloadUrls(tag, rawVersion);

  // If GitHub API provided assets, use exact matching if available
  if (item.assets && item.assets.length > 0) {
    const appImage =
      item.assets.find((a) => a.name.endsWith(".AppImage"))?.browser_download_url ||
      directUrls.appImage;
    const deb =
      item.assets.find((a) => a.name.endsWith(".deb"))?.browser_download_url || directUrls.deb;
    const rpm =
      item.assets.find((a) => a.name.endsWith(".rpm"))?.browser_download_url || directUrls.rpm;
    const sha256 =
      item.assets.find((a) => a.name.includes("SHA256SUMS"))?.browser_download_url ||
      directUrls.sha256;

    return {
      tag,
      rawVersion,
      name: item.name || `Aether API ${tag}`,
      publishedAt: item.published_at,
      htmlUrl: item.html_url || `${GITHUB_REPO}/releases/tag/${tag}`,
      isPrerelease: Boolean(item.prerelease),
      assets: { appImage, deb, rpm, sha256 },
    };
  }

  return {
    tag,
    rawVersion,
    name: item.name || `Aether API ${tag}`,
    publishedAt: item.published_at,
    htmlUrl: item.html_url || `${GITHUB_REPO}/releases/tag/${tag}`,
    isPrerelease: Boolean(item.prerelease),
    assets: directUrls,
  };
}

const CACHE_KEY = "aether_github_releases_data";
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export async function fetchReleasesData(): Promise<ReleasesData> {
  // Check sessionStorage cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.data) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }

  try {
    const res = await fetch(
      "https://api.github.com/repos/Hephaestus-Studio/aether-api/releases?per_page=15",
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const releases: GitHubReleaseApiItem[] = await res.json();

    const nonDrafts = releases.filter((r) => !r.draft);

    // Find latest stable
    const stableItem = nonDrafts.find(
      (r) =>
        !r.prerelease &&
        !r.tag_name.includes("-beta") &&
        !r.tag_name.includes("-rc") &&
        !r.tag_name.includes("-alpha"),
    );
    const stable: ReleaseChannelInfo = stableItem
      ? formatReleaseItem(stableItem)
      : DEFAULT_STABLE_RELEASE;

    // Find latest beta / prerelease
    const betaItem = nonDrafts.find(
      (r) =>
        r.prerelease ||
        r.tag_name.includes("-beta") ||
        r.tag_name.includes("-rc") ||
        r.tag_name.includes("-alpha"),
    );
    const beta: ReleaseChannelInfo | null = betaItem ? formatReleaseItem(betaItem) : null;

    let hasBetaNewer = false;
    if (beta) {
      // Compare versions: Beta must be strictly greater than Stable to be displayed
      const cmp = compareSemVer(beta.rawVersion, stable.rawVersion);
      if (cmp > 0) {
        hasBetaNewer = true;
      }
    }

    const data: ReleasesData = {
      stable,
      beta: hasBetaNewer ? beta : null,
      hasBetaNewer,
    };

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      // Ignore sessionStorage save errors
    }

    return data;
  } catch {
    // Return default stable if fetch fails
    return {
      stable: DEFAULT_STABLE_RELEASE,
      beta: null,
      hasBetaNewer: false,
    };
  }
}
