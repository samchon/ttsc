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
 */
export function startsWithConfigDirTemplate(target: string): boolean {
  const template = "${configDir}";
  return (
    target.slice(0, template.length).toLowerCase() === template.toLowerCase()
  );
}
