import fs from "node:fs";
import path from "node:path";

import { RuntimeTrash } from "../../../internal/RuntimeTrash";
import { CachePrunePolicy } from "./CachePrunePolicy";
import type { IPluginCachePruneOptions } from "./IPluginCachePruneOptions";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Opportunistically bound a part of the cache root whose entries are single
 * files: the descriptor evaluations under `descriptors/`, the capability
 * answers under `capabilities/`, the plugin content identities under
 * `identities/`, the plugin-load answers under `answers/`, and the lowered
 * orphan sources under `ttsx-orphan/`. The runtime builds under
 * `runtime-builds/` are files too, except the builds a ttsx run parked in a
 * `<key>.pending` directory: each is one entry of all its files' bytes, which
 * leaves by a rename into the store's trash.
 *
 * The policy is the plugin cache's (`CachePrunePolicy`). An entry's last use is
 * its modification time: a write sets it, and every hit records a use by
 * setting it again (`recordCacheFileUse`), improving its recent-use priority
 * under the collection policy rather than pinning it indefinitely. A writer
 * publishes an entry by renaming a finished staging file over it, so removing
 * an entry can only make a reader miss and compute the answer again, never read
 * a partial one; a staging file a crashed writer left behind is an entry nobody
 * uses, and ages out like one.
 *
 * A part absent or nonordinary at admission is left alone. A pass that gets
 * beyond the interval gate attempts marker publication after eviction; physical
 * path validation does not retain a directory handle against concurrent root
 * replacement. Failures are swallowed, since a collection must never fail the
 * launch that triggered it.
 *
 * @evidence contracts/common.md#principled-implementation Ordinary-root validation selects physical spelling for the pass, subject to that path retaining its identity during later lookups. Age and oldest-first size eviction operate on atomically published answer files and on parked build directories retired by one rename, whose removal means a cache miss rather than a partial answer; no directory handle freezes the root against concurrent replacement.
 * @evidence contracts/common.md#clear-and-simple-design Admission, age eviction, fresh accounting and size eviction are separate phases, followed by one retry marker publication.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Layout-independent file metadata drives reclamation; failures are tolerated because cache availability is optional, not hidden to fabricate a computed answer.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain payloads, hit-touch metadata, atomic publication and failure behavior under the documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation lstat rejects aliased root leaves at admission, and later paths use the observed physical root instead of the original ancestor alias. Native per-file removal handles sharing restrictions without shell assumptions; physical spelling is not an ongoing object-identity pin.
 * @evidence contracts/performance.md#efficient-algorithms Two metadata scans, including one listing and lstat per file below each parked build, and optional numeric timestamp sorting cost O(entries log entries), with temporary metadata and filename/path text scaling with admitted entries. Root validation and native metadata operations add path work, and interval-marker reading/encoding costs its text bytes; cached answer payload bytes are not read.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Answer equivalence is established by owning readers and producer keys, not eviction.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Thirty-day age and 2 GiB-triggered LRU target historical state; all entries used within the protection window and failed deletions can exceed the budget until later retry.
 */
export function pruneCacheFileRoot(
  root: string,
  options: Omit<IPluginCachePruneOptions, "protectedEntries"> = {},
): void {
  try {
    const stats = fs.lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return;
    root = SourceBuildCacheLayout.canonicalPluginCacheRoot(root);
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
    // A ttsx runtime build parked in `<key>.pending` is a directory of outputs
    // that the next run of its build adopts or discards. One whose build is
    // never requested again, because its key changed, is an entry like a file:
    // it ages out, and its bytes count toward the size budget.
    for (const entry of [...collectEntries(root), ...collectParkedBuilds(root)])
      if (now - entry.lastUsedAt > CachePrunePolicy.ENTRY_MAX_AGE_MS)
        removeEntry(entry.file, root);
    const remaining = [...collectEntries(root), ...collectParkedBuilds(root)];
    let total = remaining.reduce((sum, entry) => sum + entry.size, 0);
    if (total > maxBytes) {
      for (const entry of remaining.sort(
        (a, b) => a.lastUsedAt - b.lastUsedAt,
      )) {
        if (total <= targetBytes) break;
        if (now - entry.lastUsedAt <= protectedAgeMs) continue;
        if (removeEntry(entry.file, root)) total -= entry.size;
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

/** One ordinary cache file's eviction metadata from this pass. */
interface ICacheFileEntry {
  /** Ordinary file path under the physical answer-cache root. */
  file: string;

  /** Last-use modification timestamp in milliseconds. */
  lastUsedAt: number;

  /** Snapshot byte size. */
  size: number;
}

/** Snapshot ordinary files, excluding the collector's own interval marker. */
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

/**
 * Every parked runtime build below a `<key>.pending` directory of `root`, with
 * its directory's modification time as its last use, since parking creates it
 * and nothing writes into it afterwards, and the bytes of every file below it.
 */
function collectParkedBuilds(root: string): ICacheFileEntry[] {
  const entries: ICacheFileEntry[] = [];
  let containers: fs.Dirent[];
  try {
    containers = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const container of containers) {
    if (!container.isDirectory() || !container.name.endsWith(".pending"))
      continue;
    const directory = path.join(root, container.name);
    let names: string[];
    try {
      names = fs.readdirSync(directory);
    } catch {
      continue;
    }
    for (const name of names) {
      const file = path.join(directory, name);
      try {
        const stats = fs.lstatSync(file);
        if (stats.isDirectory())
          entries.push({
            file,
            lastUsedAt: stats.mtimeMs,
            size: treeBytes(file),
          });
      } catch {
        // Adopted or discarded since the listing.
      }
    }
  }
  return entries;
}

/** The bytes of every file below `directory`, without following links. */
function treeBytes(directory: string): number {
  let total = 0;
  const pending = [directory];
  while (pending.length !== 0) {
    const current = pending.pop()!;
    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      const target = path.join(current, child.name);
      if (child.isDirectory()) pending.push(target);
      else if (child.isFile())
        try {
          total += fs.lstatSync(target).size;
        } catch {
          // Removed since the listing.
        }
    }
  }
  return total;
}

/**
 * Attempt one payload deletion and report whether the path remains absent. A
 * parked build's directory leaves by one rename into the store's trash, so a
 * run adopting it concurrently either takes it whole or finds it gone, never a
 * partly deleted tree; a later ttsx run drains the trash.
 */
function removeEntry(file: string, root: string): boolean {
  if (path.basename(path.dirname(file)).endsWith(".pending"))
    return RuntimeTrash.retire(file, root);
  try {
    fs.rmSync(file, { force: true });
    return !fs.existsSync(file);
  } catch {
    // Windows may refuse while another process holds the file open.
    return false;
  }
}
