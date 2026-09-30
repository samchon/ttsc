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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the first signature founds an overload set. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The signatures are one identity, and the convention is a block above the first. Nothing is asked of the rest. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document only the first of two signatures plus an implementation. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedAcceptsAnOverloadSetDocumentedOnItsFirstSignature is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
