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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule over an undocumented `parse` function with the options `{"symbol":"h2"}`; assertReported requires exactly one diagnostic, containing `symbol 'h2' is not supported`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the option contract: a Markdown symbol decodes as a valid string and must be named as unsupported for this TypeScript rule rather than selecting an empty population.
 * @evidence contracts/testing.md#distinguishing-cases One unsupported symbol value on a rule with a TypeScript-only vocabulary; the rule-name attribution of the same diagnostic is checked by the sibling TestDocumentedNamesItselfForUnsupportedSymbols.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedRejectsUnsupportedSymbolValues is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedRejectsUnsupportedSymbolValues(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbol":"h2"}`)
  assertReported(t, messages, "symbol 'h2' is not supported")
}
