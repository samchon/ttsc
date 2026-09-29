/**
 * Convert Windows separators to forward slashes.
 *
 * Project keys, alias targets, and generated tsconfig paths all use one
 * separator, so equal paths compare equal regardless of the platform that
 * produced them.
 *
 * @evidence contracts/common.md#principled-implementation The helper converts path separators into the forward-slash representation consumed by project keys and generated compiler paths, without changing case or resolving identity.
 * @evidence contracts/common.md#clear-and-simple-design One separator conversion owns protocol spelling while native path resolution and physical equivalence remain separate operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Separator normalization does not pretend to prove containment, physical identity, or compiler-input freshness.
 * @evidence contracts/common.md#meaningful-documentation The native comment names the normalized representation's consumers and distinguishes it from filesystem identity.
 */
export function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
