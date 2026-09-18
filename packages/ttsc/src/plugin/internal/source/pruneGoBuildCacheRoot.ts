import fs from "node:fs";
import path from "node:path";

import { GoBuildCacheCoordination } from "./GoBuildCacheCoordination";
import type { IGoBuildCachePruneOptions } from "./IGoBuildCachePruneOptions";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Opportunistically bound one ttsc-owned Go object cache.
 *
 * A maintenance intent blocks new build leases. If any existing lease remains,
 * maintenance yields without touching the cache; the next invocation retries.
 * Only Go's two-hex object directories are scanned, so coordination metadata
 * and Go's own trim marker remain outside the size policy.
 */
export function pruneGoBuildCacheRoot(
  root: string,
  options: IGoBuildCachePruneOptions = {},
): void {
  let intent:
    | GoBuildCacheCoordination.GoBuildCacheCoordinationRecord
    | undefined;
  try {
    const cacheRoot = GoBuildCacheCoordination.canonicalGoBuildCacheRoot(root);
    const marker = path.join(cacheRoot, GO_BUILD_CACHE_GC_MARKER_FILE);
    const now = options.now ?? Date.now();
    const lastRun = SourceBuildCacheLayout.readTimestamp(marker);
    if (
      options.force !== true &&
      lastRun !== null &&
      lastRun <= now &&
      now - lastRun < GO_BUILD_CACHE_GC_INTERVAL_MS
    ) {
      return;
    }

    intent = GoBuildCacheCoordination.createGoBuildCacheCoordinationRecord(
      cacheRoot,
      GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR,
    );
    if (!intent.startHeartbeat()) {
      // Maintenance is opportunistic. Without an independent heartbeat a
      // synchronous scan could look abandoned while it is still deleting, so
      // yield instead of weakening the build/maintenance exclusion.
      return;
    }
    if (
      GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(
        cacheRoot,
        GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
        now,
      ).length !== 0
    ) {
      return;
    }

    const remainingBytes = pruneGoBuildCacheEntries(cacheRoot, {
      maxBytes: options.maxBytes ?? GO_BUILD_CACHE_MAX_BYTES,
      now,
      protectedAgeMs: options.protectedAgeMs ?? GO_BUILD_CACHE_PROTECTED_AGE_MS,
      targetBytes: options.targetBytes ?? GO_BUILD_CACHE_TARGET_BYTES,
    });
    // If recent protection or a transient delete failure left the cache above
    // the ceiling, retry after the protection window instead of suppressing
    // every maintenance attempt for a full day.
    const maxBytes = options.maxBytes ?? GO_BUILD_CACHE_MAX_BYTES;
    const protectedAgeMs =
      options.protectedAgeMs ?? GO_BUILD_CACHE_PROTECTED_AGE_MS;
    const markerTimestamp =
      remainingBytes > maxBytes
        ? now - GO_BUILD_CACHE_GC_INTERVAL_MS + protectedAgeMs
        : now;
    SourceBuildCacheLayout.replaceCacheMetadataFile(
      marker,
      `${markerTimestamp}\n`,
    );
  } catch {
    // Go-cache GC is opportunistic; builds still proceed when it fails.
  } finally {
    intent?.finish();
  }
}

// Go's own object-cache trim is age-based and has no size ceiling. The default
// ttsc-owned cache therefore keeps up to 8 GiB and trims oldest objects toward
// 6 GiB. The newest target-sized set used within an hour remains protected so
// crossing the ceiling cannot immediately force another cold build.
const GO_BUILD_CACHE_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;

const GO_BUILD_CACHE_MAX_BYTES = 8 * 1024 * 1024 * 1024;

const GO_BUILD_CACHE_TARGET_BYTES = 6 * 1024 * 1024 * 1024;

const GO_BUILD_CACHE_PROTECTED_AGE_MS = 60 * 60 * 1000;

const GO_BUILD_CACHE_GC_MARKER_FILE = ".ttsc-gc";

// Go amortizes cache-hit mtime writes over one hour. An object used inside
// ttsc's one-hour protection window may therefore still carry an mtime almost
// one additional hour old.
const GO_BUILD_CACHE_ACCESS_MTIME_GRANULARITY_MS = 60 * 60 * 1000;

interface GoBuildCacheObject {
  file: string;
  lastUsedAt: number;
  size: number;
}

/** Prune oldest Go cache objects to the requested deterministic size target. */
function pruneGoBuildCacheEntries(
  root: string,
  options: {
    maxBytes: number;
    now: number;
    protectedAgeMs: number;
    targetBytes: number;
  },
): number {
  const entries = collectGoBuildCacheObjects(root);
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= options.maxBytes) {
    return total;
  }
  // Protect the newest recent objects only up to one target-sized cohort
  // reserve. Protecting every object younger than an hour would let repeated
  // 2.9 GiB cold builds grow without bound during that hour.
  const protectedFiles = new Set<string>();
  let protectedBytes = 0;
  for (const entry of [...entries].sort(
    (a, b) => b.lastUsedAt - a.lastUsedAt,
  )) {
    if (
      options.now - entry.lastUsedAt >
      options.protectedAgeMs + GO_BUILD_CACHE_ACCESS_MTIME_GRANULARITY_MS
    ) {
      continue;
    }
    if (protectedBytes >= options.targetBytes) {
      break;
    }
    if (protectedBytes + entry.size > options.targetBytes) {
      break;
    }
    protectedFiles.add(entry.file);
    protectedBytes += entry.size;
  }
  for (const entry of entries.sort((a, b) => a.lastUsedAt - b.lastUsedAt)) {
    if (total <= options.targetBytes) {
      return total;
    }
    if (protectedFiles.has(entry.file)) {
      continue;
    }
    try {
      fs.rmSync(entry.file, { force: true });
      total -= entry.size;
    } catch {
      // A concurrent antivirus/indexer can transiently hold a file on Windows.
    }
  }
  return total;
}

function collectGoBuildCacheObjects(root: string): GoBuildCacheObject[] {
  const output: GoBuildCacheObject[] = [];
  let buckets: fs.Dirent[];
  try {
    buckets = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const bucket of buckets) {
    if (!bucket.isDirectory() || !/^[0-9a-f]{2}$/.test(bucket.name)) {
      continue;
    }
    const directory = path.join(root, bucket.name);
    let files: fs.Dirent[];
    try {
      files = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.isFile()) {
        continue;
      }
      const absolute = path.join(directory, file.name);
      try {
        const stats = fs.statSync(absolute);
        output.push({
          file: absolute,
          lastUsedAt: stats.mtimeMs,
          size: stats.size,
        });
      } catch {}
    }
  }
  return output;
}
