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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies namespace members are selected. The original assertions check assert both members are reported.
 * @evidence contracts/testing.md#independent-expectations A namespace contains public units of its own, and a member that cannot carry a block cannot cite the evidence its parent's claim obligates. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document a namespace but leave a nested type and a nested const bare. Run the rule. Assert both members are reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsNamespaceMembers is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
