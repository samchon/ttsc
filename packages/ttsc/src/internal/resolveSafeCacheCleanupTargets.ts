import fs from "node:fs";
import path from "node:path";

import type { SafeCacheCleanupTarget } from "./SafeCacheCleanupTarget";
import { type FilesystemPathIdentityOperations } from "./pathIdentity/FilesystemPathIdentityOperations";
import { createFilesystemPathIdentityContext } from "./pathIdentity/createFilesystemPathIdentityContext";
import { isFilesystemPathIdentityWithin } from "./pathIdentity/isFilesystemPathIdentityWithin";
import { resolveFilesystemPath } from "./pathIdentity/resolveFilesystemPath";

/**
 * Resolve one cache-clean transaction to physical deletion targets.
 *
 * Every target is proved before the caller removes the first one. Existing
 * aliases are pinned to their physical spelling, while a missing suffix keeps
 * the identity of its nearest existing parent. Identity errors other than a
 * genuinely missing path fail closed.
 */
export function resolveSafeCacheCleanupTargets(
  projectRoot: string,
  cacheDirectories: readonly string[],
  operations: Partial<FilesystemPathIdentityOperations> = {},
): SafeCacheCleanupTarget[] {
  const identities = createFilesystemPathIdentityContext(operations);
  const lstat = operations.lstat ?? fs.lstatSync;
  const project = identities.resolve(projectRoot);
  return cacheDirectories.map((cacheDirectory) => {
    const requestedCache = resolveFilesystemPath(cacheDirectory);
    // Fix every mutable alias ancestor before inspecting the terminal entry.
    // All later identity checks and deletion paths use this physical-parent
    // candidate, so a concurrent retarget cannot move ownership mid-proof.
    const pinnedCache = path.join(
      identities.resolve(path.dirname(requestedCache)).path,
      path.basename(requestedCache),
    );
    const cache = identities.resolve(pinnedCache);
    if (
      requestedCache === path.parse(requestedCache).root ||
      cache.path === path.parse(cache.path).root
    ) {
      throw new Error(
        `ttsc: refusing to clean cache directory ${JSON.stringify(requestedCache)} because filesystem roots are never valid cache directories`,
      );
    }
    if (isFilesystemPathIdentityWithin(cache.key, project.key)) {
      throw new Error(
        `ttsc: refusing to clean cache directory ${JSON.stringify(requestedCache)} because it equals or contains project root ${JSON.stringify(project.path)}; choose a dedicated cache directory`,
      );
    }
    const status = lstatIfPresent(pinnedCache, lstat);
    // Recursive rm removes a terminal symlink or junction itself rather than
    // following it. Preserve that behavior while pinning any mutable alias in
    // its ancestors to the physical parent selected by this transaction.
    const deletionPath = status?.isSymbolicLink() ? pinnedCache : cache.path;
    return {
      exists: status !== undefined,
      path: deletionPath,
      requestedPath: requestedCache,
    };
  });
}

function lstatIfPresent(
  location: string,
  lstat: NonNullable<FilesystemPathIdentityOperations["lstat"]>,
): fs.Stats | fs.BigIntStats | undefined {
  try {
    return lstat(location);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return undefined;
    }
    throw error;
  }
}
