import fs from "node:fs";
import path from "node:path";

/**
 * Return an existing ordinary identities directory below a selected record
 * root, or leave temporary placement to the caller's system default.
 *
 * The returned physical path is a direct child of the selected root. The caller
 * still uses createCanonicalTempDirectory to verify its own allocation; these
 * observations do not hold the namespace against later mutation.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath and link-preserving stat admit only a present ordinary identities directory whose physical parent is the selected root; an unproved path supplies no alternate temporary parent.
 * @evidence contracts/common.md#clear-and-simple-design One small selector shares the same record-root placement rule between descriptor evaluation and child output capture; allocation and cleanup remain with their respective owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function neither creates a cache root nor accepts a linked identities entry as evidence of an owned child; failed observations retain the ordinary caller path.
 * @evidence contracts/common.md#meaningful-documentation The comment states the selected-root premise, returned physical path and remaining namespace race without claiming held-directory protection.
 * @evidence contracts/portability.md#os-neutral-implementation Node native path and filesystem APIs observe the actual root and child without assuming case policy or a fixed temporary volume; a junctioned selected root can resolve to its physical directory, while the identities entry itself must be ordinary.
 * @evidence contracts/performance.md#efficient-algorithms A fixed number of native path observations and path-text operations selects the parent without enumeration; lookup depth and path length determine their underlying cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A record root or identities entry can be replaced between calls, so each allocation needs current observations instead of a remembered parent.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selector acquires no handle or directory and retains no state; its returned path is caller-owned text.
 */
export function selectedRecordIdentityTempParent(
  recordRoot: string | undefined,
): string | undefined {
  if (recordRoot === undefined || !path.isAbsolute(recordRoot))
    return undefined;
  try {
    const physicalRoot = fs.realpathSync.native(recordRoot);
    if (!fs.lstatSync(physicalRoot).isDirectory()) return undefined;
    const identities = path.join(recordRoot, "identities");
    const identityStats = fs.lstatSync(identities);
    if (!identityStats.isDirectory() || identityStats.isSymbolicLink())
      return undefined;
    const physicalIdentities = fs.realpathSync.native(identities);
    return path.dirname(physicalIdentities) === physicalRoot
      ? physicalIdentities
      : undefined;
  } catch {
    return undefined;
  }
}
