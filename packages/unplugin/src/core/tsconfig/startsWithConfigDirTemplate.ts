/**
 * Match the case-insensitive prefix TypeScript-Go uses before configDir
 * substitution.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Comparing the leading template-length substring with case normalization
 *   implements the compiler's prefix rule without changing the remaining path.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One predicate owns recognition while resolveConfigDirTemplatePath owns
 *   replacement and native anchoring.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The recognized constant is compiler syntax, not a fixture-specific marker.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The comment states prefix and case semantics, avoiding a claim that this
 *   predicate validates the complete target path or resolves an actual file.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A case-insensitive prefix test on a configuration string, as TypeScript-Go does before substitution; it reads no filesystem.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function startsWithConfigDirTemplate(target: string): boolean {
  const template = "${configDir}";
  return (
    target.slice(0, template.length).toLowerCase() === template.toLowerCase()
  );
}
