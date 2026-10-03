/**
 * Keep the dependency, VCS and ttsc plugin stores outside project discovery.
 *
 * All other names are governed by the selected project rather than guessed
 * directory conventions.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Exact equality identifies the three stores outside this source-discovery
 *   contract; ordinary output and hidden directories remain policy-owned.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One predicate owns the traversal's unconditional directory omissions.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   These store names express traversal ownership, not expected fixture answers
 *   or an expanding list of guessed consumer output directories.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The comment names the omitted stores and explains why other directory names
 *   remain configuration decisions instead of repeating a boolean expression.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares a bare directory name with three literals; it reads no filesystem and parses no path.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Three exact fixed-length literals define the product-owned omission set;
 *   no input collection/traversal or growing matching strategy is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isIgnoredProjectDirectory(name: string): boolean {
  // These are discovery-owned stores. Other names remain project-policy choices.
  return name === ".git" || name === ".ttsc" || name === "node_modules";
}
