package evidence

import "testing"

/**
 * Verifies the rule fires on an undocumented export and names the reason.
 *
 * The anchor case. The diagnostic has to say why a missing block matters, or a
 * reader treats it as a style preference and disables it — the point is that a
 * declaration without a block has nowhere to put a citation at all.
 *
 *  1. Export one function with no JSDoc.
 *  2. Run the rule with the default selection.
 *  3. Assert the finding names the declaration and the consequence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an undocumented `export function parse`; assertReported is called twice and requires exactly one diagnostic that contains both `Missing JSDoc on exported function 'parse'` and `only ever read from a JSDoc block`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the diagnostic contract: it must name the declaration and say why a block matters (an `@evidence` tag is only read from a JSDoc block), so it is not read as a style preference.
 * @evidence contracts/testing.md#distinguishing-cases This is the anchor reporting case, the control that the accept entries rely on to show the rule fires; one undocumented function with default selection.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsUndocumentedExport is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedReportsUndocumentedExport(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'parse'")
  assertReported(t, messages, "only ever read from a JSDoc block")
}
