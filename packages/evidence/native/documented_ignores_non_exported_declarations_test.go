package evidence

import "testing"

/**
 * Verifies non-exported declarations are never required to be documented.
 *
 * The rule is about the public surface. Demanding a block on every local helper
 * would make the rule unusable in the implementation files it is meant to
 * protect.
 *
 *  1. Declare two undocumented local helpers beside one documented export.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies non-exported declarations are never required to be documented. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations The rule is about the public surface. Demanding a block on every local helper would make the rule unusable in the implementation files it is meant to protect. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Declare two undocumented local helpers beside one documented export. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedIgnoresNonExportedDeclarations is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedIgnoresNonExportedDeclarations(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/parse.ts", `
const cache = new Map<string, string>();
function normalize(value: string): string {
  return value.trim();
}
/** Normalizes a raw input value. */
export function parse(value: string): string {
  return normalize(value) + cache.size;
}
`, ""))
}
