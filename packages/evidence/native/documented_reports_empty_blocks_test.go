package evidence

import "testing"

/**
 * Verifies an empty block gets its own diagnostic.
 *
 * A block with neither prose nor tag satisfies nothing, but reporting it as
 * "missing" would confuse a reader looking straight at one. The separate
 * message also keeps the emptiness check visibly structural rather than a
 * judgment about what was written.
 *
 *  1. Document an export with an empty block.
 *  2. Run the rule.
 *  3. Assert the emptiness message rather than the missing one.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `export function parse` preceded by an empty `/** *\/` block; assertReported requires exactly one diagnostic, `Empty JSDoc on exported function 'parse'`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the documented-rule contract: a block with neither prose nor tag satisfies nothing but must be reported as empty rather than missing, since the author is looking at a block.
 * @evidence contracts/testing.md#distinguishing-cases One empty block on a function; the asterisk-only block and the empty first declaration of a merged identity are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsEmptyBlocks is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedReportsEmptyBlocks(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
/** */
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Empty JSDoc on exported function 'parse'")
}
