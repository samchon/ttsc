package evidence

import "testing"

/**
 * Verifies an unsupported symbol value is rejected.
 *
 * The Markdown vocabulary shares the option shape, so `h2` decodes cleanly as a
 * string and would otherwise select nothing at all — a rule that silently
 * checks an empty population.
 *
 *  1. Configure a Markdown symbol on a TypeScript rule.
 *  2. Run the rule.
 *  3. Assert the value is named as unsupported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an unsupported symbol value is rejected. The original assertions check assert the value is named as unsupported.
 * @evidence contracts/testing.md#independent-expectations The Markdown vocabulary shares the option shape, so `h2` decodes cleanly as a string and would otherwise select nothing at all — a rule that silently checks an empty population. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Configure a Markdown symbol on a TypeScript rule. Run the rule. Assert the value is named as unsupported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedRejectsUnsupportedSymbolValues is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedRejectsUnsupportedSymbolValues(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbol":"h2"}`)
  assertReported(t, messages, "symbol 'h2' is not supported")
}
