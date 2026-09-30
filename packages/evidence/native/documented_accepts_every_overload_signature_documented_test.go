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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a block on every overload signature is fine. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Per-signature JSDoc is a real language-service feature — an editor shows the matching signature's block at a call site — and judging only the first declaration leaves that untouched rather than forcing a choice between the two. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document every signature of an overload set. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedAcceptsEveryOverloadSignatureDocumented is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
