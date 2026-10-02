package evidence

import "testing"

/**
 * Verifies a whitespace-and-asterisk block is empty too.
 *
 * A multi-line block whose lines hold only the leading asterisk looks
 * substantial in a diff and says nothing, so the emptiness check has to strip
 * the same decoration the tag parser does.
 *
 *  1. Document an export with a multi-line block of bare asterisks.
 *  2. Run the rule.
 *  3. Assert the emptiness message.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `export function parse` preceded by a multi-line `/**` block whose only line holds a bare asterisk; assertReported requires exactly one diagnostic, `Empty JSDoc on exported function 'parse'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the emptiness contract: decoration (the leading asterisks and whitespace) is stripped as the tag parser strips it, so a block of bare asterisks says nothing and is empty, not missing.
 * @evidence contracts/testing.md#distinguishing-cases A multi-line decorated empty block against the single-line `/** *\/` form owned by the sibling empty-block entry.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedTreatsAsteriskOnlyBlocksAsEmpty is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedTreatsAsteriskOnlyBlocksAsEmpty(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
/**
 *
 */
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Empty JSDoc on exported function 'parse'")
}
