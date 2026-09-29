import fs from "node:fs";
import path from "node:path";

/**
 * Return the nearest existing directory at or above `file` that a recursive
 * watch can own, or `undefined` when only a volume root remains.
 *
 * A missing input is observed through the directory that will announce its
 * creation. A volume root is never watched recursively, since that would
 * observe an unbounded, unrelated tree.
 *
 * @evidence contracts/common.md#principled-implementation Missing inputs are anchored at the closest readable existing directory, while rejecting a volume root avoids recursively observing unrelated machine state.
 * @evidence contracts/common.md#clear-and-simple-design The ancestor walk advances by native dirname until a usable directory or root is reached; no secondary watch policy is introduced.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed stat calls never authorize a watch on a presumed directory, and the root exclusion follows the stated ownership boundary rather than a test-specific path.
 * @evidence contracts/common.md#meaningful-documentation The comment explains how creation is observed and why reaching a volume root returns undefined.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral ancestor selection uses native resolve/dirname and actual directory stat results, so volume-root and inaccessible-path behavior follow the observed host.
 */
export function nearestExistingDirectory(file: string): string | undefined {
  let current = path.resolve(file);
  try {
    if (!fs.statSync(current).isDirectory()) current = path.dirname(current);
  } catch {
    current = path.dirname(current);
  }
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
