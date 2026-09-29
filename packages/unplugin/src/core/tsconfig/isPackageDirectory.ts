/**
 * Whether a directory name is one of the package folders TypeScript's wildcard
 * matcher never enters.
 *
 * `node_modules`, `bower_components`, and `jspm_packages` are skipped by `*`
 * and `**` components exactly as TypeScript-Go's matcher skips them, so
 * membership never admits package sources through a wildcard.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Anchored case-insensitive matching identifies exactly the compiler's three
 *   package-directory names, preserving its wildcard exclusion semantics.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One predicate owns package-name grammar for recursive and ordinary wildcard
 *   transitions instead of duplicating those conditions.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The names are compiler-defined package boundaries, not inferred output
 *   directories or aliases selected for fixtures.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the names and which wildcard rules exclude them,
 *   stating semantic purpose rather than only describing a regular expression.
 */
export function isPackageDirectory(name: string): boolean {
  return /^(node_modules|bower_components|jspm_packages)$/i.test(name);
}
