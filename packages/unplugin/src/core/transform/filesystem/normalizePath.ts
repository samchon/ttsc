/**
 * Convert Windows separators to forward slashes.
 *
 * Project keys, alias targets, and generated tsconfig paths all use one
 * separator spelling. This conversion does not establish filesystem identity or
 * make paths from different native filesystems equivalent.
 *
 * @evidence contracts/common.md#principled-implementation The helper converts path separators into the forward-slash representation consumed by project keys and generated compiler paths, without changing case or resolving identity.
 * @evidence contracts/common.md#clear-and-simple-design One separator conversion owns protocol spelling while native path resolution and physical equivalence remain separate operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Separator normalization does not pretend to prove containment, physical identity, or compiler-input freshness.
 * @evidence contracts/common.md#meaningful-documentation The native comment names the normalized representation's consumers and distinguishes it from filesystem identity.
 * @evidence contracts/portability.md#os-neutral-implementation The slash conversion serves project keys, alias targets and compiler configuration values; a spelling handed to a filesystem or a bundler is never rewritten, and identity comes from the filesystem identity context.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One fixed replacement scans the supplied path spelling in linear time
 *   and creates at most a same-length result; it performs no filesystem walk.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
