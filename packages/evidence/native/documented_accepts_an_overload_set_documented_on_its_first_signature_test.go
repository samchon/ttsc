package evidence

import "testing"

/**
 * Verifies the first signature founds an overload set.
 *
 * The signatures are one identity, and the convention is a block above the
 * first. Nothing is asked of the rest.
 *
 *  1. Document only the first of two signatures plus an implementation.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `format` written as two overload signatures and an implementation, with a block only above the first signature; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: the overload signatures are one identity and the convention is a block above the first, with nothing asked of the rest.
 * @evidence contracts/testing.md#distinguishing-cases A block on the first signature only; the all-signatures-documented case is a sibling accept entry and the later-only and undocumented rejections are owned by sibling report entries.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedAcceptsAnOverloadSetDocumentedOnItsFirstSignature is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedAcceptsAnOverloadSetDocumentedOnItsFirstSignature(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/format.ts", `
/** Renders a value for display. */
export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
`, ""))
}
