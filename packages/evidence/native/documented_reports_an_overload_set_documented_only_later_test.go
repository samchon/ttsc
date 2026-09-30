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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies an overload set documented only on a later signature is reported. The original assertions check assert the callable is reported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The twin proving the first signature is the basis rather than merely one acceptable position among several. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Leave the first signature bare and document the second. Run the rule. Assert the callable is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedReportsAnOverloadSetDocumentedOnlyLater is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
