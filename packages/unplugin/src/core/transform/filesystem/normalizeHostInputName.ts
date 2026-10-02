/**
 * Normalize one directory entry under the owning filesystem's case policy.
 *
 * @evidence contracts/common.md#principled-implementation Case-sensitive observations preserve exact entry spelling; only the owning filesystem's insensitive policy authorizes lowercase comparison.
 * @evidence contracts/common.md#clear-and-simple-design One explicit policy parameter controls entry normalization without rereading directory capability or resolving a whole path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operating-system names do not substitute for the observed directory policy, and normalization changes comparison spelling only.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies entry-level normalization and ownership of the required case policy.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral name comparison uses the caller's observed filesystem case policy rather than an unconditional Windows/POSIX rule.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function normalizeHostInputName(
  name: string,
  caseSensitive: boolean,
): string {
  return caseSensitive ? name : name.toLowerCase();
}
