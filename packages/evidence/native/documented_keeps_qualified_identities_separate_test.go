package evidence

import "testing"

/**
 * Verifies a documented inner declaration does not discharge an outer one of
 * the same name.
 *
 * Identity is qualified, so `A.f` and `f` are different obligations. A grouping
 * keyed on the bare name plus source adjacency would let the inner block excuse
 * the outer declaration — a silent miss, and the failure mode this rule exists
 * to remove.
 *
 *  1. Document a namespace member named `f` and leave a top-level `f` bare.
 *  2. Run the rule.
 *  3. Assert the top-level declaration is still reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `namespace A` containing a documented `function f` and an undocumented top-level `export function f`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'f'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the documented-rule contract: identities are qualified, so `A.f` and `f` are different obligations and the inner block cannot excuse the outer declaration.
 * @evidence contracts/testing.md#distinguishing-cases The same bare name at two nesting levels with only the inner one documented; a grouping on the bare name would find a block and stay silent, failing the exactly-one assertion.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedKeepsQualifiedIdentitiesSeparate is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedKeepsQualifiedIdentitiesSeparate(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/f.ts", `
/** Namespace A. */
export namespace A {
  /** Inner documented. */
  export function f(): void {}
}
export function f(): void {}
`, ""), "Missing JSDoc on exported function 'f'")
}
