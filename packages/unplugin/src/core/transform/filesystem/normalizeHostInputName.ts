/**
 * Normalize one directory entry under the owning filesystem's case policy.
 *
 * @evidence contracts/common.md#principled-implementation Case-sensitive observations preserve exact entry spelling; only the owning filesystem's insensitive policy authorizes lowercase comparison.
 * @evidence contracts/common.md#clear-and-simple-design One explicit policy parameter controls entry normalization without rereading directory capability or resolving a whole path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operating-system names do not substitute for the observed directory policy, and normalization changes comparison spelling only.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies entry-level normalization and ownership of the required case policy.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral name comparison uses the caller's observed filesystem case policy rather than an unconditional Windows/POSIX rule.
 */
export function normalizeHostInputName(
  name: string,
  caseSensitive: boolean,
): string {
  return caseSensitive ? name : name.toLowerCase();
}
