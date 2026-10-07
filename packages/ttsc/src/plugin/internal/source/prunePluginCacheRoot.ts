import fs from "node:fs";
import path from "node:path";

import { CachePrunePolicy } from "./CachePrunePolicy";
import type { IPluginCachePruneOptions } from "./IPluginCachePruneOptions";
import { PluginBinaryUse } from "./PluginBinaryUse";
import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { PluginBuildLockOwner } from "./PluginBuildLockOwner";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { acquirePluginBuildLock } from "./acquirePluginBuildLock";
import { inspectPluginBuildLock } from "./inspectPluginBuildLock";
import { reclaimPluginBuildLock } from "./reclaimPluginBuildLock";
import { releasePluginBuildLock } from "./releasePluginBuildLock";

/**
 * Attempt age/size-based eviction in the plugin binary cache.
 *
 * Normally once a day (unless `force`), entries unused for 30 days are eligible
 * for removal and, past a 2 GiB threshold, oldest eligible entries are removed
 * toward 80% of it (`CachePrunePolicy`). A target-sized cohort of recently used
 * entries, active builds and entries named in `protectedEntries` survive. When
 * the protected set alone keeps the root over the ceiling, the daily marker is
 * backdated so a later invocation becomes eligible after the protection window
 * instead of a day later. Failed removals, protected/live/unknown owners and
 * incomplete accounting can leave the cache above its thresholds indefinitely.
 * Exceptions are swallowed; native calls and delegated retries can still block
 * a build.
 *
 * Payload deletion acquires the same v3 per-key lease as a builder. A task
 * retired while it was still running remains protected until its exact
 * release-owned completion or proven process absence. Old v2 clients use an
 * independent namespace, so their liveness check is conservative observation
 * rather than atomic cross-version serialization. Returned binaries have
 * independent process-reader reservations. Deletion inspects them under its key
 * lease and preserves live or unknown consumers, including after a producer has
 * completed and released its build lease.
 *
 * Binary eviction preserves coordination roots. A v3 retired generation is
 * reclaimed only after its holder and every registered observer are provably
 * gone; their tokens may otherwise still act on that generation. Older v2
 * generations have no observer registry and remain untouched. Persistent roots
 * therefore still grow with historical keys even after binaries are evicted.
 *
 * @evidence contracts/common.md#principled-implementation Binary deletion acquires a v3 per-key lease and rechecks old v2 plus unfinished retired-task ownership; completed payload work and reusable fence history have distinct proofs, under the cooperating protocol's lifetime premises.
 * @evidence contracts/common.md#clear-and-simple-design Binary accounting and generation-history reclamation remain separate phases because their ownership lifetimes differ.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Old v2 capabilities are not assumed expired; unknown ownership defers reclamation instead of hiding protocol uncertainty under a timeout.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish target-sized recent protection, retry behavior and persistent coordination-root growth.
 * @evidence contracts/portability.md#os-neutral-implementation Root and history-child lstat/realpath checks and payload Dirent selection use observed native kinds and spelling; these sequential observations do not pin pathnames against replacement. Native deletion failures defer eviction without assuming volume case policy.
 * @evidence contracts/performance.md#efficient-algorithms Age and size phases take two recursive payload metadata snapshots; two entry sorts add O(E log E) comparisons. Work includes entry/path text, native size/timestamp observations, explicit exclusions and repeated per-key owner/generation/observer/reader JSON and liveness scans, plus recursive deletion contents. Binary bytes are not read, but inaccessible size observations can undercount. Delegated lock inspection/retirement can retry without a deadline.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Producers and build locks establish valid binary reuse; this operation selects reclamation candidates.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each deletion attempt owns one v3 lease with finally release/reporting; cleanup failure may retain ownership, and eligible native retries can block indefinitely. Inspection can publish process-lifetime observer records. Removal of payload/history is attempted, not guaranteed: live/unknown readers, protected entries, failures, old v2 history and persistent roots can retain bytes or historical keys without a finite bound. Backdated markers only enable a later invocation.
 */
export function prunePluginCacheRoot(
  root: string,
  options: IPluginCachePruneOptions = {},
): void {
  try {
    const cacheRoot = SourceBuildCacheLayout.canonicalPluginCacheRoot(root);
    const marker = path.join(cacheRoot, CachePrunePolicy.GC_MARKER_FILE);
    const now = options.now ?? Date.now();
    const lastRun = SourceBuildCacheLayout.readTimestamp(marker);
    if (
      options.force !== true &&
      lastRun !== null &&
      lastRun <= now &&
      now - lastRun < CachePrunePolicy.GC_INTERVAL_MS
    ) {
      return;
    }
    const remainingBytes = prunePluginCacheEntries(cacheRoot, {
      maxBytes: options.maxBytes ?? CachePrunePolicy.MAX_BYTES,
      now,
      protectedEntries: canonicalPluginCacheProtectedEntries(
        cacheRoot,
        options.protectedEntries ?? [],
      ),
      protectedAgeMs:
        options.protectedAgeMs ?? CachePrunePolicy.PROTECTED_AGE_MS,
      targetBytes: options.targetBytes ?? CachePrunePolicy.TARGET_BYTES,
    });
    pruneRetiredLockGenerations(cacheRoot);
    const maxBytes = options.maxBytes ?? CachePrunePolicy.MAX_BYTES;
    const protectedAgeMs =
      options.protectedAgeMs ?? CachePrunePolicy.PROTECTED_AGE_MS;
    const markerTimestamp =
      remainingBytes > maxBytes
        ? now - CachePrunePolicy.GC_INTERVAL_MS + protectedAgeMs
        : now;
    SourceBuildCacheLayout.replaceCacheMetadataFile(
      marker,
      `${markerTimestamp}\n`,
    );
  } catch {
    // Plugin-cache GC is opportunistic; builds still proceed when it fails.
  }
}

/** Resolve explicit GC exclusions without accepting aliases outside root. */
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

/** Evict unused binary entries and then oldest unprotected entries over budget. */
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
      options.now - entry.lastUsedAt <= CachePrunePolicy.ENTRY_MAX_AGE_MS ||
      options.protectedEntries.has(entry.dir) ||
      pluginCacheEntryHasActiveBuild(entry)
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
    if (pluginCacheEntryHasActiveBuild(entry)) {
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

/** Protect a binary while current or previous-protocol ownership may be live. */
function pluginCacheEntryHasActiveBuild(entry: PluginCacheEntry): boolean {
  const lockDir = `${entry.dir}.lock`;
  try {
    if (pluginCacheEntryHasLiveV2Build(entry)) return true;
    return inspectPluginBuildLock(lockDir).state === "active";
  } catch {
    // Malformed or unreadable coordination state cannot disprove ownership.
    return true;
  }
}

/**
 * Protect an old v2 current owner unless its absence is established. Old
 * clients do not share the v3 acquisition transaction, so this observation
 * cannot provide atomic exclusion against a later old-client acquisition.
 */
function pluginCacheEntryHasLiveV2Build(entry: PluginCacheEntry): boolean {
  const current = path.join(`${entry.dir}.lock.v2`, "current");
  try {
    fs.lstatSync(current);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
  }
  try {
    const generation = fs
      .readFileSync(
        path.join(
          current,
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE,
        ),
        "utf8",
      )
      .trim();
    const owner = readQualifiedPluginCacheTaskOwner(current, generation);
    return owner === null || !PluginBuildLockOwner.gone(owner);
  } catch {
    return true;
  }
}

/**
 * Protect payloads of retired tasks that may still publish or delete.
 *
 * Exact release-owned completion ends payload activity without revoking the
 * independently retained fence. A live or uncertain holder without that witness
 * remains protected, even though current ownership has moved on.
 */
function pluginCacheEntryHasUnfinishedRetiredTask(lockDir: string): boolean {
  const protocolRoot =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  const retired = path.join(
    protocolRoot,
    PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_RETIRED_DIR,
  );
  if (!isOrdinaryCacheChild(protocolRoot, retired)) return true;
  try {
    for (const generation of fs.readdirSync(retired)) {
      const location = path.join(retired, generation);
      if (!isOrdinaryCacheChild(retired, location)) return true;
      if (PluginBuildLockOwner.taskComplete(location, generation)) continue;
      const owner = readQualifiedPluginCacheTaskOwner(location, generation);
      if (owner === null || !PluginBuildLockOwner.gone(owner)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Correlate a holder's absence proof with the generation being reclaimed. A
 * syntactically valid but unrelated owner record cannot authorize payload or
 * history deletion; its generation and the immutable generation file must
 * identify this same task.
 */
function readQualifiedPluginCacheTaskOwner(
  location: string,
  generation: string,
): PluginBuildLockOwner.IRecord | null {
  if (!PluginBuildLockProtocol.isPluginBuildLockGeneration(generation)) {
    return null;
  }
  try {
    const recorded = fs
      .readFileSync(
        path.join(
          location,
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_GENERATION_FILE,
        ),
        "utf8",
      )
      .trim();
    if (recorded !== generation) return null;
    const owner = PluginBuildLockOwner.read(location);
    return owner?.generation === generation ? owner : null;
  } catch {
    return null;
  }
}

/** Binary-entry metadata used by one eviction pass. */
interface PluginCacheEntry {
  /** Ordinary binary-entry directory under the physical cache root. */
  dir: string;

  /** Last-use timestamp in milliseconds. */
  lastUsedAt: number;

  /** Recursively observed payload bytes. */
  size: number;
}

/** Snapshot ordinary binary directories separately from coordination roots. */
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

/** Read usage metadata, falling back to binary or directory timestamps. */
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

/** Sum ordinary payload-file bytes without following listed symbolic entries. */
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

/** Remove one binary payload while preserving independent lock capabilities. */
function removeCacheEntry(entry: PluginCacheEntry): boolean {
  const lockDir = `${entry.dir}.lock`;
  let lease: PluginBuildLockLease | null = null;
  try {
    lease = acquirePluginBuildLock(lockDir);
    if (lease === null) {
      const observed = inspectPluginBuildLock(lockDir);
      if (observed.state === "abandoned" && observed.fence.protocol === "v3") {
        const current = path.join(
          PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir),
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_CURRENT_DIR,
        );
        const owner = readQualifiedPluginCacheTaskOwner(
          current,
          observed.fence.generation,
        );
        // One proven-dead generation may be retired before one acquisition
        // retry. A deadline or missing owner never authorizes GC stealing.
        if (
          owner !== null &&
          owner.generation === observed.fence.generation &&
          PluginBuildLockOwner.gone(owner) &&
          reclaimPluginBuildLock(lockDir, observed.fence)
        ) {
          lease = acquirePluginBuildLock(lockDir);
        }
      }
    }
    if (
      lease === null ||
      pluginCacheEntryHasLiveV2Build(entry) ||
      pluginCacheEntryHasUnfinishedRetiredTask(lockDir) ||
      PluginBinaryUse.hasLiveOwners(entry.dir)
    ) {
      return false;
    }
    fs.rmSync(entry.dir, { recursive: true, force: true });
    if (fs.existsSync(entry.dir)) return false;
    return true;
  } catch {
    // Failed acquisition or native sharing errors defer optional eviction.
    return false;
  } finally {
    if (lease !== null) {
      try {
        releasePluginBuildLock(lockDir, lease);
      } catch {
        // Preserve generation history; never remove a successor to force GC.
      }
    }
  }
}

/**
 * Reclaim v3 tombstones only when their owner and every registered observer are
 * provably gone. Missing, malformed or unreadable ownership is retained. v2 has
 * no observer registry and cannot supply this proof.
 */
function pruneRetiredLockGenerations(root: string): void {
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.endsWith(".lock.v3")) continue;
    const protocolRoot = path.join(root, name);
    if (!isOrdinaryCacheChild(root, protocolRoot)) continue;
    const retired = path.join(
      protocolRoot,
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_RETIRED_DIR,
    );
    if (!isOrdinaryCacheChild(protocolRoot, retired)) continue;
    let tombstones: string[];
    try {
      tombstones = fs.readdirSync(retired);
    } catch {
      continue;
    }
    for (const tombstone of tombstones) {
      const location = path.join(retired, tombstone);
      if (!isOrdinaryCacheChild(retired, location)) continue;
      const owner = readQualifiedPluginCacheTaskOwner(location, tombstone);
      if (owner === null || !PluginBuildLockOwner.gone(owner)) continue;
      const observers = path.join(
        location,
        PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OBSERVERS_DIR,
      );
      let allObserversGone = true;
      try {
        if (!isOrdinaryCacheChild(location, observers)) {
          // Absence is the valid no-observer state. A present alias or a
          // nonordinary entry cannot prove that registered observers are gone.
          fs.lstatSync(observers);
          continue;
        }
        for (const observer of fs.readdirSync(observers)) {
          const observerDirectory = path.join(observers, observer);
          if (!isOrdinaryCacheChild(observers, observerDirectory)) {
            allObserversGone = false;
            break;
          }
          const holder = PluginBuildLockOwner.read(observerDirectory);
          if (holder === null || !PluginBuildLockOwner.gone(holder)) {
            allObserversGone = false;
            break;
          }
        }
      } catch (error) {
        allObserversGone = (error as NodeJS.ErrnoException).code === "ENOENT";
      }
      if (!allObserversGone) continue;
      try {
        fs.rmSync(location, { recursive: true, force: true });
      } catch {
        // Left for the next pass.
      }
    }
  }
}

/** Require an ordinary immediate physical child before tombstone traversal. */
function isOrdinaryCacheChild(parent: string, child: string): boolean {
  try {
    const stats = fs.lstatSync(child);
    return (
      stats.isDirectory() &&
      !stats.isSymbolicLink() &&
      path.dirname(fs.realpathSync.native(child)) === parent
    );
  } catch {
    return false;
  }
}
