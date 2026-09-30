package evidence

import "testing"

/**
 * Verifies a documented declaration exported through an alias is silent.
 *
 * The block sits on the declaration, while the export list carries the public
 * name. A rule keyed on the export list would find no block and report a
 * documented declaration.
 *
 *  1. Document a local declaration and export it under another name.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a documented declaration exported through an alias is silent. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations The block sits on the declaration, while the export list carries the public name. A rule keyed on the export list would find no block and report a documented declaration. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document a local declaration and export it under another name. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedFindsTheBlockOnAnAliasedDeclaration is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedFindsTheBlockOnAnAliasedDeclaration(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/Other.ts", `
/** The single exported contract. */
interface Local {
  /** Identifier of the contract. */
  id: string;
}
export { Local as Other };
`, ""))
}
