import fs from "node:fs";
import path from "node:path";

/**
 * Return the nearest ancestor observed as a directory, excluding a volume root.
 * Failure to observe a nearer component continues the search; the result does
 * not prove readability, successful watch acquisition or complete topology.
 *
 * A missing input is observed through the directory that will announce its
 * creation. A volume root is never watched recursively, since that would
 * observe an unbounded, unrelated tree.
 *
 * @evidence contracts/common.md#principled-implementation A directory stat selects a candidate watch anchor, not a readability or watch-capability certificate. Rejecting a volume root avoids recursively observing unrelated machine state.
 * @evidence contracts/common.md#clear-and-simple-design The ancestor walk advances by native dirname until a usable directory or root is reached; no secondary watch policy is introduced.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed stat calls never authorize a watch on a presumed directory, and the root exclusion follows the stated ownership boundary rather than a test-specific path.
 * @evidence contracts/common.md#meaningful-documentation The comment explains how creation is observed and why reaching a volume root returns undefined.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral ancestor selection uses native resolve/dirname and actual directory stat results, so volume-root and inaccessible-path behavior follow the observed host.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources statSync returns before the function does; no handle is retained.
 * @evidence contracts/performance.md#efficient-algorithms Each of D candidates is statted once, with native path-component/link costs. Repeated dirname text can cost D times path length; no directory contents or file bytes are read.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The answer depends on the filesystem now and is requested when an input registers; an earlier answer is not reused.
 */
export function nearestExistingDirectory(file: string): string | undefined {
  let current = path.resolve(file);
  for (;;) {
    try {
      if (fs.statSync(current).isDirectory()) {
        return path.dirname(current) === current ? undefined : current;
      }
    } catch {
      // Keep climbing to the nearest directory a recursive watch can own.
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
