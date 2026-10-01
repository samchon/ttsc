package evidence

import "testing"

/**
 * Verifies namespace members are selected.
 *
 * A namespace contains public units of its own, and a member that cannot carry
 * a block cannot cite the evidence its parent's claim obligates.
 *
 *  1. Document a namespace but leave a nested type and a nested const bare.
 *  2. Run the rule.
 *  3. Assert both members are reported.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `namespace Orders` containing an undocumented `export interface IInput` (documented `id`) and an undocumented `export const version`; assertReportedAmong requires a diagnostic for `exported type 'Orders.IInput'` and one for `exported property 'Orders.version'`.
 * @evidence contracts/testing.md#independent-expectations The expected names are authored from the addressing contract: namespace members are public units of their own and must be demanded with their qualified names.
 * @evidence contracts/testing.md#distinguishing-cases A nested type and a nested const as two member kinds; only containment is asserted, so additional diagnostics would not fail the test.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsNamespaceMembers is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedSelectsNamespaceMembers(t *testing.T) {
  messages := runDocumentedRule(t, "src/Orders.ts", `
/** Order contracts. */
export namespace Orders {
  export interface IInput {
    /** Identifier of the order. */
    id: string;
  }
  export const version = "1";
}
`, "")
  assertReportedAmong(t, messages, "Missing JSDoc on exported type 'Orders.IInput'")
  assertReportedAmong(t, messages, "Missing JSDoc on exported property 'Orders.version'")
}
