package evidence

import "testing"

/**
 * Verifies an unsupported symbol value also names the owning rule.
 *
 * The symbol decoder is the second shared entry point, and it reports through a
 * different branch than TestDocumentedNamesItselfInConfigurationDiagnostics. Fixing one and leaving the
 * other would misattribute exactly the configuration a reader is most likely to
 * get wrong, since the Markdown vocabulary decodes cleanly as a string.
 *
 *  1. Configure a Markdown symbol on a TypeScript rule.
 *  2. Run the rule.
 *  3. Assert the message names `evidence/documented`.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule over an exported `parse` function with the options `{"symbol":"h2"}`; assertReported is called twice and requires exactly one diagnostic that contains both `Invalid evidence/documented configuration` and `symbol 'h2' is not supported`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the diagnostic contract: an unsupported symbol value (the Markdown vocabulary decodes as a valid string) must be rejected with the owning rule's name in the message.
 * @evidence contracts/testing.md#distinguishing-cases This covers the symbol-decoder branch of the shared option decoding; the unknown-key branch is covered by the sibling TestDocumentedNamesItselfInConfigurationDiagnostics, so fixing only one would leave the other failing.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedNamesItselfForUnsupportedSymbols is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedNamesItselfForUnsupportedSymbols(t *testing.T) {
  messages := runDocumentedRule(t, "src/parse.ts", `
export function parse(value: string): string {
  return value;
}
`, `{"symbol":"h2"}`)
  assertReported(t, messages, "Invalid evidence/documented configuration")
  assertReported(t, messages, "symbol 'h2' is not supported")
}
