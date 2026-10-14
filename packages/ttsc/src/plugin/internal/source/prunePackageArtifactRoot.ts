import fs from "node:fs";
import path from "node:path";

import { SourceNativeRetirement } from "../../../internal/SourceNativeRetirement";
import { GoBuildCacheCoordination } from "./GoBuildCacheCoordination";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Reclaim a default-owned package artifact population after size or idle age.
 *
 * The entire base and overlay share an eviction generation. A Go-cache
 * maintenance intent excludes cooperating builders while the native guard
 * reader retains unknown process-tree outcomes. Explicit cache roots are never
 * passed here. Metadata accounting is bounded and cannot establish a hard disk
 * ceiling while another process writes or a protected generation remains.
 *
 * @evidence contracts/common.md#principled-implementation The same maintenance and native-guard gates used by the owning Go cache precede deletion of the sibling artifact population.
 * @evidence contracts/common.md#clear-and-simple-design One idle/size decision reclaims a complete base-and-overlay generation, leaving future builds to prepare a fresh root.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown files, aliases and unresolved native owners refuse reclamation rather than being silently ignored.
 * @evidence contracts/common.md#meaningful-documentation The comment states whole-generation eviction and its concurrency and accounting limits.
 * @evidence contracts/portability.md#os-neutral-implementation Native path, directory and metadata APIs inspect ordinary entries on Windows and POSIX.
 * @evidence contracts/performance.md#efficient-algorithms A bounded metadata walk visits at most 100000 entries and six directory levels; it reads no body bytes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This routine decides deletion from mutable ownership and filesystem state, not reusable compilation identity.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Sixteen GiB or 30 idle days triggers best-effort generation removal; active/unknown owners, locked files and errors can defer reclamation without a hard ceiling.
 */
export function prunePackageArtifactRoot(
  goBuildRoot: string,
  artifactRoot: string,
  now: number = Date.now(),
): void {
  let intent:
    | GoBuildCacheCoordination.GoBuildCacheCoordinationRecord
    | undefined;
  try {
    const cacheRoot =
      GoBuildCacheCoordination.canonicalGoBuildCacheRoot(goBuildRoot);
    const parent = fs.realpathSync.native(path.dirname(artifactRoot));
    if (
      parent !== path.dirname(cacheRoot) ||
      path.basename(artifactRoot) !==
        SourceBuildCacheLayout.PACKAGE_ARTIFACTS_DIRNAME
    )
      return;
    const info = fs.lstatSync(artifactRoot);
    if (!info.isDirectory() || info.isSymbolicLink()) return;
    const physical = fs.realpathSync.native(artifactRoot);
    if (path.dirname(physical) !== parent) return;
    if (SourceNativeRetirement.isProtected(physical)) return;

    intent = GoBuildCacheCoordination.createGoBuildCacheCoordinationRecord(
      cacheRoot,
      GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR,
    );
    if (!intent.startHeartbeat()) return;
    if (
      GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(
        cacheRoot,
        GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
        now,
      ).length !== 0 ||
      SourceNativeRetirement.isProtected(physical)
    )
      return;

    const marker = path.join(physical, ".last-used");
    const lastUsed = SourceBuildCacheLayout.readTimestamp(marker);
    const expired = lastUsed !== null && now - lastUsed > 30 * DAY_MS;
    const bytes = countArtifactBytes(physical);
    if (expired || bytes > 16 * GIB) fs.rmSync(physical, { recursive: true });
  } catch {
    // A failed ownership observation or locked Windows body defers collection.
  } finally {
    intent?.finish();
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const GIB = 1024 * 1024 * 1024;

function countArtifactBytes(root: string): number {
  let entries = 0;
  let total = 0;
  const walk = (directory: string, depth: number): void => {
    if (depth > 6) throw new Error("artifact directory depth exceeds policy");
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (++entries > 100000)
        throw new Error("artifact entry count exceeds policy");
      const child = path.join(directory, entry.name);
      const info = fs.lstatSync(child);
      if (info.isSymbolicLink()) throw new Error("aliased artifact entry");
      if (info.isDirectory()) walk(child, depth + 1);
      else if (info.isFile()) total += info.size;
      else throw new Error("unknown artifact entry");
      if (!Number.isSafeInteger(total))
        throw new Error("artifact size exceeds policy");
    }
  };
  walk(root, 0);
  return total;
}
