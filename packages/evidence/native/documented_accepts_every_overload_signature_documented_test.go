package evidence

import "testing"

/**
 * Verifies a block on every overload signature is fine.
 *
 * Per-signature JSDoc is a real language-service feature — an editor shows the
 * matching signature's block at a call site — and judging only the first
 * declaration leaves that untouched rather than forcing a choice between the
 * two.
 *
 *  1. Document every signature of an overload set.
 *  2. Run the rule.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `format` written as two overload signatures and an implementation, each preceded by its own content block; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: only the founding declaration of an identity is judged, so additional blocks on the other signatures neither help nor count against it.
 * @evidence contracts/testing.md#distinguishing-cases Every signature documented, against the first-signature-only accept case and the undocumented or later-only report cases owned by sibling entries; a rule that counted blocks per signature would fail here.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsEveryOverloadSignatureDocumented is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsEveryOverloadSignatureDocumented(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/format.ts", `
/** Renders a string for display. */
export function format(value: string): string;
/** Renders a number for display. */
export function format(value: number): string;
/** Renders either for display. */
export function format(value: string | number): string {
  return String(value);
}
`, ""))
}
