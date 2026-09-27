import fs from "node:fs";
import path from "node:path";

import { CachePrunePolicy } from "./CachePrunePolicy";
import type { IPluginCachePruneOptions } from "./IPluginCachePruneOptions";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Opportunistically bound a part of the cache root whose entries are single
 * files: the descriptor evaluations under `descriptors/`, the capability
 * answers under `capabilities/`, and the lowered orphan sources under
 * `ttsx-orphan/` (samchon/ttsc#1562).
 *
 * The policy is the plugin cache's (`CachePrunePolicy`). An entry's last use is
 * its modification time: a write sets it, and every hit records a use by
 * setting it again (`recordCacheFileUse`), so the entries launches keep reading
 * stay. A writer publishes an entry by renaming a finished staging file over
 * it, so removing an entry can only make a reader miss and compute the answer
 * again, never read a partial one; a staging file a crashed writer left behind
 * is an entry nobody uses, and ages out like one.
 *
 * Nothing is created: a part that does not exist, or that is not an ordinary
 * directory, is left alone. Failures are swallowed, since a collection must
 * never fail the launch that triggered it.
 */
export function pruneCacheFileRoot(
  root: string,
  options: Omit<IPluginCachePruneOptions, "protectedEntries"> = {},
): void {
  try {
    const stats = fs.lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return;
    const marker = path.join(root, CachePrunePolicy.GC_MARKER_FILE);
    const now = options.now ?? Date.now();
    const lastRun = SourceBuildCacheLayout.readTimestamp(marker);
    if (
      options.force !== true &&
      lastRun !== null &&
      lastRun <= now &&
      now - lastRun < CachePrunePolicy.GC_INTERVAL_MS
    )
      return;
    const maxBytes = options.maxBytes ?? CachePrunePolicy.MAX_BYTES;
    const protectedAgeMs =
      options.protectedAgeMs ?? CachePrunePolicy.PROTECTED_AGE_MS;
    const targetBytes = options.targetBytes ?? CachePrunePolicy.TARGET_BYTES;
    for (const entry of collectEntries(root))
      if (now - entry.lastUsedAt > CachePrunePolicy.ENTRY_MAX_AGE_MS)
        removeEntry(entry.file);
    const remaining = collectEntries(root);
    let total = remaining.reduce((sum, entry) => sum + entry.size, 0);
    if (total > maxBytes) {
      for (const entry of remaining.sort(
        (a, b) => a.lastUsedAt - b.lastUsedAt,
      )) {
        if (total <= targetBytes) break;
        if (now - entry.lastUsedAt <= protectedAgeMs) continue;
        if (removeEntry(entry.file)) total -= entry.size;
      }
    }
    SourceBuildCacheLayout.replaceCacheMetadataFile(
      marker,
      `${
        total > maxBytes
          ? now - CachePrunePolicy.GC_INTERVAL_MS + protectedAgeMs
          : now
      }\n`,
    );
  } catch {
    // Collection is opportunistic; the launch proceeds when it fails.
  }
}

interface ICacheFileEntry {
  file: string;
  lastUsedAt: number;
  size: number;
}

function collectEntries(root: string): ICacheFileEntry[] {
  const entries: ICacheFileEntry[] = [];
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const dirent of dirents) {
    if (!dirent.isFile() || dirent.name === CachePrunePolicy.GC_MARKER_FILE)
      continue;
    const file = path.join(root, dirent.name);
    try {
      const stats = fs.lstatSync(file);
      if (!stats.isFile()) continue;
      entries.push({ file, lastUsedAt: stats.mtimeMs, size: stats.size });
    } catch {
      // Removed or replaced since the listing: not an entry this pass sees.
    }
  }
  return entries;
}

function removeEntry(file: string): boolean {
  try {
    fs.rmSync(file, { force: true });
    return !fs.existsSync(file);
  } catch {
    // Windows may refuse while another process holds the file open.
    return false;
  }
}
