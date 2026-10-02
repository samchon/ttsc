/**
 * Whether a directory name is one of the package folders TypeScript's wildcard
 * matcher never enters.
 *
 * `node_modules`, `bower_components`, and `jspm_packages` are skipped by `*`
 * and `**` components exactly as TypeScript-Go's matcher skips them, so
 * membership never admits package sources through a wildcard.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Anchored case-insensitive alternatives recognize the three complete ASCII
 *   package names. Without the multiline flag, the dollar assertion requires
 *   the end of input, so a trailing line terminator does not qualify.
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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares a bare directory name with three package-folder names, ignoring case as TypeScript's matcher does; it reads no filesystem.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Three fixed anchored alternatives compare package names of at most sixteen
 *   code units. No normalized-name copy, variable traversal or lookup
 *   population is created.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isPackageDirectory(name: string): boolean {
  return /^(node_modules|bower_components|jspm_packages)$/i.test(name);
}
