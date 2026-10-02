/**
 * Escape a literal extension for a generated regular expression.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Prefixing regex metacharacters with a backslash converts extension text
 *   into literal pattern content while ordinary characters retain their meaning.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One replacement isolates escaping from source-table and filter construction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The metacharacter set follows regex syntax rather than particular extensions.
 * @evidence contracts/common.md#meaningful-documentation
 *   The native comment names literal escaping and its filter role, with a blank
 *   separator before tags as documentation guidance requires.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
