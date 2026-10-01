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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented non-exported `interface Local` (with a documented `id`) exported by `export { Local as Other };`; assertSilent requires no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the documented-rule contract: the block sits on the declaration while the export list carries the public name, and the rule must find the declaration's block rather than look for one at the export list.
 * @evidence contracts/testing.md#distinguishing-cases An aliased export of a documented local declaration; the undocumented export and re-export cases are owned by sibling entries. Silence alone would also occur if the rule ignored aliased exports, which the sibling report entries do not directly guard.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedFindsTheBlockOnAnAliasedDeclaration is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
