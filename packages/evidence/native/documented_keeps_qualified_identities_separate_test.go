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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a documented inner declaration does not discharge an outer one of the same name. The original assertions check assert the top-level declaration is still reported.
 * @evidence contracts/testing.md#independent-expectations Identity is qualified, so `A.f` and `f` are different obligations. A grouping keyed on the bare name plus source adjacency would let the inner block excuse the outer declaration — a silent miss, and the failure mode this rule exists to remove. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document a namespace member named `f` and leave a top-level `f` bare. Run the rule. Assert the top-level declaration is still reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedKeepsQualifiedIdentitiesSeparate is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
