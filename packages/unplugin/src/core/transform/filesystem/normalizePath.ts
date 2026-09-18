/**
 * Convert Windows separators to forward slashes.
 *
 * Project keys, generated tsconfig targets, and diagnostics all use one
 * separator, so equal paths compare equal regardless of the platform that
 * produced them.
 */
export function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
