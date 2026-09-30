package evidence

import "testing"

/**
 * Verifies a const founds the identity its default export re-exposes.
 *
 * `export default x` declares nothing and materializes no unit, so the const is
 * the natural first declaration and no special case is needed. This is the
 * shape the plugin's own entry point uses.
 *
 *  1. Document the const and leave the default export bare.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a const founds the identity its default export re-exposes. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `export default x` declares nothing and materializes no unit, so the const is the natural first declaration and no special case is needed. This is the shape the plugin's own entry point uses. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Document the const and leave the default export bare. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedAcceptsAConstDocumentedBeforeItsDefaultExport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedAcceptsAConstDocumentedBeforeItsDefaultExport(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/evidence.ts", `
/** The exported plugin descriptor. */
export const evidence = { name: "evidence" };
export default evidence;
`, ""))
}
