/**
 * Whether a directory name is one of the package folders TypeScript's wildcard
 * matcher never enters.
 *
 * `node_modules`, `bower_components`, and `jspm_packages` are skipped by `*`
 * and `**` components exactly as TypeScript-Go's matcher skips them, so
 * membership never admits package sources through a wildcard.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Each fixed-length branch matches only its complete ASCII package name,
 *   ignoring ASCII case like the compiler's length-guarded EqualFold boundary.
 *   The length check prevents a final line terminator from qualifying through
 *   JavaScript's dollar anchor; it is part of full-name recognition.
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
 *   String length selects one fixed package name or rejects immediately. The
 *   selected anchored comparison examines at most sixteen code units; no
 *   normalized-name copy, variable traversal or lookup population is created.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isPackageDirectory(name: string): boolean {
  switch (name.length) {
    case 12:
      return /^node_modules$/i.test(name);
    case 13:
      return /^jspm_packages$/i.test(name);
    case 16:
      return /^bower_components$/i.test(name);
    default:
      return false;
  }
}
