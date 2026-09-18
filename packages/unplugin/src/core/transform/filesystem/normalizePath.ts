/**
 * Convert Windows separators to forward slashes.
 *
 * Project keys, alias targets, and generated tsconfig paths all use one
 * separator, so equal paths compare equal regardless of the platform that
 * produced them.
 */
export function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
