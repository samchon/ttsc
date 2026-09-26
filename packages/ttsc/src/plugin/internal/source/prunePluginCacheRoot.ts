import fs from "node:fs";
import path from "node:path";

import type { IPluginCachePruneOptions } from "./IPluginCachePruneOptions";
import { PluginBuildLockOwner } from "./PluginBuildLockOwner";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { inspectPluginBuildLock } from "./inspectPluginBuildLock";

/**
 * Opportunistically bound the plugin binary cache.
 *
 * At most once a day (unless `force`), entries unused for 30 days are evicted
 * and, past a 2 GiB ceiling, the least-recently used down to 80% of it. Entries
 * used within the protection window and entries named in `protectedEntries`
 * (the binary a cold build just returned) survive. When the protected set alone
 * keeps the root over the ceiling, the daily marker is backdated so another
 * pass runs soon instead of a day later. Failures are swallowed: pruning must
 * never fail a build.
 *
 * An evicted entry takes its build-lock state with it, and every pass drops the
 * retired-generation tombstones whose recorded holder is provably gone, so the
 * coordination state of keys no longer built stays bounded too
 * (samchon/ttsc#1558). A tombstone fences a late release of its generation, and
 * the lock only keeps two processes from building one key at once: publication
 * is an atomic rename of a complete binary, so a fence given up this way can at
 * worst let a key be built twice, never publish a partial or foreign binary.
 */
export function prunePluginCacheRoot(
  root: string,
  options: IPluginCachePruneOptions = {},
): void {
  try {
    const cacheRoot = SourceBuildCacheLayout.canonicalPluginCacheRoot(root);
    const marker = path.join(cacheRoot, CACHE_GC_MARKER_FILE);
    const now = options.now ?? Date.now();
    const lastRun = SourceBuildCacheLayout.readTimestamp(marker);
    if (
      options.force !== true &&
      lastRun !== null &&
      lastRun <= now &&
      now - lastRun < PLUGIN_CACHE_GC_INTERVAL_MS
    ) {
      return;
    }
    const remainingBytes = prunePluginCacheEntries(cacheRoot, {
      maxBytes: options.maxBytes ?? PLUGIN_CACHE_MAX_BYTES,
      now,
      protectedEntries: canonicalPluginCacheProtectedEntries(
        cacheRoot,
        options.protectedEntries ?? [],
      ),
      protectedAgeMs: options.protectedAgeMs ?? PLUGIN_CACHE_PROTECTED_AGE_MS,
      targetBytes: options.targetBytes ?? PLUGIN_CACHE_TARGET_BYTES,
    });
    pruneRetiredLockGenerations(cacheRoot);
    const maxBytes = options.maxBytes ?? PLUGIN_CACHE_MAX_BYTES;
    const protectedAgeMs =
      options.protectedAgeMs ?? PLUGIN_CACHE_PROTECTED_AGE_MS;
    const markerTimestamp =
      remainingBytes > maxBytes
        ? now - PLUGIN_CACHE_GC_INTERVAL_MS + protectedAgeMs
        : now;
    SourceBuildCacheLayout.replaceCacheMetadataFile(
      marker,
      `${markerTimestamp}\n`,
    );
  } catch {
    // Plugin-cache GC is opportunistic; builds still proceed when it fails.
  }
}

const CACHE_GC_MARKER_FILE = ".gc-last-run";

// The plugin binary cache is content-keyed, so a project that bumps tsgo/typia
// many times leaves one stale entry per superseded key. An opportunistic GC
// (once/day) evicts entries unused for 30 days and, past a 2 GB ceiling, the
// least-recently-used down to 80%. It is scoped to the resolved cache root only
// — ttsc never scans a shared or global location.
const PLUGIN_CACHE_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;

const PLUGIN_CACHE_ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const PLUGIN_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024;

const PLUGIN_CACHE_TARGET_BYTES = Math.floor(PLUGIN_CACHE_MAX_BYTES * 0.8);

const PLUGIN_CACHE_PROTECTED_AGE_MS = 60 * 60 * 1000;

/** Resolve explicit GC exclusions without allowing an alias outside root. */
function canonicalPluginCacheProtectedEntries(
  root: string,
  entries: readonly string[],
): Set<string> {
  const protectedEntries = new Set<string>();
  for (const entry of entries) {
    const candidate = path.resolve(entry);
    const stats = fs.lstatSync(candidate);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: unsafe protected plugin cache entry: ${entry}`);
    }
    const physical = fs.realpathSync.native(candidate);
    if (path.dirname(physical) !== root) {
      throw new Error(
        `ttsc: protected plugin cache entry escaped root: ${entry}`,
      );
    }
    protectedEntries.add(physical);
  }
  return protectedEntries;
}

function prunePluginCacheEntries(
  root: string,
  options: {
    maxBytes: number;
    now: number;
    protectedAgeMs: number;
    protectedEntries: ReadonlySet<string>;
    targetBytes: number;
  },
): number {
  const entries = collectPluginCacheEntries(root, options.now);
  for (const entry of entries) {
    if (
      options.now - entry.lastUsedAt <= PLUGIN_CACHE_ENTRY_MAX_AGE_MS ||
      options.protectedEntries.has(entry.dir) ||
      pluginCacheEntryHasActiveBuild(entry, options.now)
    ) {
      continue;
    }
    removeCacheEntry(entry);
  }

  const remaining = collectPluginCacheEntries(root, options.now);
  let total = remaining.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= options.maxBytes) {
    return total;
  }
  const protectedEntries = new Set<string>(options.protectedEntries);
  let protectedBytes = 0;
  for (const entry of [...remaining].sort(
    (a, b) => b.lastUsedAt - a.lastUsedAt,
  )) {
    if (pluginCacheEntryHasActiveBuild(entry, options.now)) {
      protectedEntries.add(entry.dir);
      continue;
    }
    if (options.now - entry.lastUsedAt > options.protectedAgeMs) continue;
    if (protectedBytes >= options.targetBytes) continue;
    if (protectedBytes + entry.size > options.targetBytes) continue;
    protectedEntries.add(entry.dir);
    protectedBytes += entry.size;
  }
  for (const entry of remaining.sort((a, b) => a.lastUsedAt - b.lastUsedAt)) {
    if (total <= options.targetBytes) {
      return total;
    }
    if (protectedEntries.has(entry.dir)) continue;
    if (removeCacheEntry(entry)) total -= entry.size;
  }
  return total;
}

/** Conservatively protect an entry while any build generation owns its key. */
function pluginCacheEntryHasActiveBuild(
  entry: PluginCacheEntry,
  now: number,
): boolean {
  const lockDir = `${entry.dir}.lock`;
  try {
    return inspectPluginBuildLock(lockDir, now).state === "active";
  } catch {
    // Malformed or unreadable coordination state cannot disprove ownership.
    return true;
  }
}

interface PluginCacheEntry {
  dir: string;
  lastUsedAt: number;
  size: number;
}

function collectPluginCacheEntries(
  root: string,
  now: number,
): PluginCacheEntry[] {
  const entries: PluginCacheEntry[] = [];
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const dirent of dirents) {
    if (
      !dirent.isDirectory() ||
      dirent.name.endsWith(".lock") ||
      dirent.name.includes(".lock.")
    ) {
      continue;
    }
    const dir = path.join(root, dirent.name);
    const lastUsedAt = readCacheEntryLastUsedAt(dir, now);
    entries.push({
      dir,
      lastUsedAt,
      size: directorySize(dir),
    });
  }
  return entries;
}

function readCacheEntryLastUsedAt(dir: string, now: number): number {
  const touched = SourceBuildCacheLayout.readTimestamp(
    path.join(dir, SourceBuildCacheLayout.CACHE_LAST_USED_FILE),
  );
  if (touched !== null) {
    return touched;
  }
  for (const name of ["plugin", "plugin.exe"]) {
    try {
      return fs.statSync(path.join(dir, name)).mtimeMs;
    } catch {}
  }
  try {
    return fs.statSync(dir).mtimeMs;
  } catch {
    return now;
  }
}

function directorySize(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return total;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += directorySize(file);
      } else if (entry.isFile()) {
        total += fs.statSync(file).size;
      }
    } catch {}
  }
  return total;
}

function removeCacheEntry(entry: PluginCacheEntry): boolean {
  try {
    fs.rmSync(entry.dir, { recursive: true, force: true });
    if (fs.existsSync(entry.dir)) return false;
  } catch {
    // Windows may reject removal while a plugin binary is still running.
    return false;
  }
  // The key's lock was inactive when the entry was chosen, so its protocol
  // directory, with its tombstones, and a released legacy lock go with it.
  for (const lock of [`${entry.dir}.lock.v2`, `${entry.dir}.lock`]) {
    try {
      fs.rmSync(lock, { recursive: true, force: true });
    } catch {
      // Left for the next pass.
    }
  }
  return true;
}

/**
 * Remove every retired-generation tombstone whose recorded holder is provably
 * gone (`PluginBuildLockOwner.gone`): a holder that cannot run cannot release
 * its generation late, which is all its tombstone fences. A tombstone whose
 * holder is on another host, alive, or unrecorded is kept.
 */
function pruneRetiredLockGenerations(root: string): void {
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.endsWith(".lock.v2")) continue;
    const retired = path.join(
      root,
      name,
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_RETIRED_DIR,
    );
    let tombstones: string[];
    try {
      tombstones = fs.readdirSync(retired);
    } catch {
      continue;
    }
    for (const tombstone of tombstones) {
      const location = path.join(retired, tombstone);
      const owner = PluginBuildLockOwner.read(location);
      if (owner === null || !PluginBuildLockOwner.gone(owner)) continue;
      try {
        fs.rmSync(location, { recursive: true, force: true });
      } catch {
        // Left for the next pass.
      }
    }
  }
}
