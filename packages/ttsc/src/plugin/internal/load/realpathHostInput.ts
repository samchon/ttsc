import fs from "node:fs";

/**
 * Physical path selected by a host input, or null while it is unresolved.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath reports the target the filesystem currently selects; any unresolved query returns null so cache comparison cannot assume the lexical spelling is its physical target.
 * @evidence contracts/common.md#clear-and-simple-design One nullable observation gives all host-input snapshot consumers the same failure policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Canonicalization failure does not reuse an old answer, rewrite filesystem globals or guess a platform target.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states physical-target and unresolved semantics, with separate acknowledgment prose following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation fs.realpathSync.native handles the OS's own path/link semantics; the implementation avoids POSIX separator processing and blanket case folding.
 * @evidence contracts/performance.md#efficient-algorithms One native realpath query performs no content scan or redundant user-space ancestor traversal.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fresh target observation is required for cache validity; this function retains no realpath cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous query returns a caller-owned string or null and retains no handle or population.
 */
export function realpathHostInput(file: string): string | null {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return null;
  }
}
