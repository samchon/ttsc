import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CanonicalTempDirectoryOperations } from "./CanonicalTempDirectoryOperations";

/**
 * Create a unique temporary directory under an observed physical parent.
 *
 * Resolving the parent before creation removes the caller's TEMP/TMPDIR alias
 * from the returned path. The postflight accepts a directory only when its
 * physical path is a direct child of that parent. Prefixes must name one native
 * basename and cannot be the navigation components `.` or `..`.
 *
 * A failed postflight leaves the allocated entry untouched because its safe
 * ownership was not established. These observations hold no directory handle
 * and are not atomic with later use: they do not prevent another actor from
 * changing the physical namespace after validation. The caller owns cleanup of
 * an accepted directory and must preserve that boundary during its use.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath, unique allocation and link-preserving stat establish the observed physical parent and accepted direct child; reserved navigation prefixes are rejected before allocation rather than creating an entry outside that parent.
 * @evidence contracts/common.md#clear-and-simple-design One creator owns preflight, allocation and postflight through three filesystem primitives; callers receive an accepted physical path and own subsequent use and cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed observations propagate without substituting a guessed path or recursively deleting an entry whose ownership is unproven; injected primitives belong to this boundary rather than replacing foreign globals.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain prefix restrictions, alias removal, postflight rejection, possible unclaimed allocation and the lack of atomic or held-directory protection under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation node:path assembles and validates native names, os.tmpdir supplies the default parent, and native realpath expands aliases; no fixed temporary root, manual separator replacement or OS-wide case folding determines containment.
 * @evidence contracts/performance.md#efficient-algorithms Prefix checks and native path assembly scan path text; a fixed number of realpath/stat observations and one unique allocation delegate alias resolution and filesystem lookup work. No explicit directory enumeration occurs here, but the fixed call count does not bound native lookup, alias depth or allocation costs. Temporary path strings grow with the observed native spellings.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call requires a unique allocation and current parent/child observations; reusing an earlier directory or postflight would violate that ownership boundary.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources An accepted directory transfers to its caller for cleanup, and this function retains no registry or open handle. A rejected or unobservable postflight can leave an allocation because no safe cleanup target is established; that failure is propagated rather than claiming all allocations were reclaimed.
 */
export function createCanonicalTempDirectory(
  prefix: string,
  parent: string = os.tmpdir(),
  operations: CanonicalTempDirectoryOperations = FILESYSTEM_OPERATIONS,
): string {
  if (
    prefix.length === 0 ||
    prefix === "." ||
    prefix === ".." ||
    path.basename(prefix) !== prefix
  ) {
    throw new TypeError("ttsc: temporary directory prefix must be a basename");
  }
  const physicalParent = operations.realpath(path.resolve(parent));
  if (!operations.lstat(physicalParent).isDirectory()) {
    throw new Error(
      `ttsc: temporary directory parent is not a directory: ${physicalParent}`,
    );
  }
  const directory = operations.mkdtemp(path.join(physicalParent, prefix));
  if (!operations.lstat(directory).isDirectory()) {
    throw new Error(
      `ttsc: temporary directory postflight is not a directory: ${directory}`,
    );
  }
  const physicalDirectory = operations.realpath(directory);
  if (path.dirname(physicalDirectory) !== physicalParent) {
    throw new Error(
      `ttsc: temporary directory escaped its physical parent: ${physicalDirectory}`,
    );
  }
  return physicalDirectory;
}

const FILESYSTEM_OPERATIONS: CanonicalTempDirectoryOperations = {
  lstat: fs.lstatSync,
  mkdtemp: fs.mkdtempSync,
  realpath: fs.realpathSync.native,
};
