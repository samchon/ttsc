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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a whitespace-and-asterisk block is empty too. The original assertions check assert the emptiness message.
 * @evidence contracts/testing.md#independent-expectations A multi-line block whose lines hold only the leading asterisk looks substantial in a diff and says nothing, so the emptiness check has to strip the same decoration the tag parser does. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document an export with a multi-line block of bare asterisks. Run the rule. Assert the emptiness message. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedTreatsAsteriskOnlyBlocksAsEmpty is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
