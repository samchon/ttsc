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
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
