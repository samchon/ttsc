/**
 * Whether a directory name is one of the package folders TypeScript's wildcard
 * matcher never enters.
 *
 * `node_modules`, `bower_components`, and `jspm_packages` are skipped by `*`
 * and `**` components exactly as TypeScript-Go's matcher skips them, so
 * membership never admits package sources through a wildcard.
 */
export function isPackageDirectory(name: string): boolean {
  return /^(node_modules|bower_components|jspm_packages)$/i.test(name);
}
