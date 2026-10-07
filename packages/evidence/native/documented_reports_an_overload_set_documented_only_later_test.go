package evidence

import "testing"

/**
 * Verifies an overload set documented only on a later signature is reported.
 *
 * The twin proving the first signature is the basis rather than merely one
 * acceptable position among several.
 *
 *  1. Leave the first signature bare and document the second.
 *  2. Run the rule.
 *  3. Assert the callable is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over `format` written as a bare first overload signature, a documented second signature and an implementation; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'format'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the founding-declaration contract: the first signature is the basis of an overload set, so a block on a later signature must not satisfy it.
 * @evidence contracts/testing.md#distinguishing-cases The rejecting counterpart of the first-signature-documented accept entry: only the position of the one block differs, and exactly one report is required for the whole set.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReportsAnOverloadSetDocumentedOnlyLater is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedReportsAnOverloadSetDocumentedOnlyLater(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/format.ts", `
export function format(value: string): string;
/** Renders a number for display. */
export function format(value: number): string;
export function format(value: string | number): string {
  return String(value);
}
`, ""), "Missing JSDoc on exported function 'format'")
}
