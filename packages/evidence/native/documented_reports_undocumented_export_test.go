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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the rule fires on an undocumented export and names the reason. The original assertions check assert the finding names the declaration and the consequence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The anchor case. The diagnostic has to say why a missing block matters, or a reader treats it as a style preference and disables it — the point is that a declaration without a block has nowhere to put a citation at all. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export one function with no JSDoc. Run the rule with the default selection. Assert the finding names the declaration and the consequence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedReportsUndocumentedExport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
